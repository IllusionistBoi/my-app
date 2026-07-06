from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from unittest import skipUnless
from unittest.mock import patch

from django.apps import apps
from django.core.cache import cache
from django.core.management import call_command
from django.db import close_old_connections, connection
from django.test import SimpleTestCase, TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import Session, SessionMembership
from .throttles import SessionCreateThrottle


def bearer(token):
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class SessionAPITests(APITestCase):
    def setUp(self):
        cache.clear()

    def create_session(self, username="alice", session_name="Sprint planning"):
        response = self.client.post(
            "/api/sessions/create/",
            {"username": username, "session_name": session_name},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return (
            response.data["session"]["session_id"],
            response.data["participant_token"],
            response,
        )

    def join_session(self, session_id, username="bob"):
        self.client.credentials()
        response = self.client.post(
            "/api/sessions/join/",
            {"username": username, "sessionId": session_id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return response.data["participant_token"], response

    def test_create_returns_atomic_session_scoped_capability(self):
        session_id, token, response = self.create_session()

        self.assertTrue(token)
        self.assertEqual(response.data["session"]["session_id"], session_id)
        self.assertEqual(response.data["session"]["participants"], ["alice"])
        self.assertEqual(response.data["session"]["round_number"], 1)
        self.assertFalse(response.data["session"]["is_revealed"])
        self.assertEqual(response["Cache-Control"], "no-store, private")
        self.assertTrue(
            SessionMembership.objects.get(
                session__session_id=session_id,
                user__username="alice",
            ).capability_digest
        )
        self.assertEqual(
            self.client.post(
                "/api/sessions/token/", {"username": "alice"}, format="json"
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_missing_tampered_and_cross_session_capabilities_are_rejected(self):
        first_id, first_token, _ = self.create_session("alice")
        second_id, _, _ = self.create_session("carol")

        self.client.credentials()
        self.assertEqual(
            self.client.get(f"/api/sessions/{first_id}/details/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.client.get(
                f"/api/sessions/{first_id}/details/",
                **bearer(f"{first_token}tampered"),
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        cross_response = self.client.get(
            f"/api/sessions/{second_id}/details/",
            **bearer(first_token),
        )
        self.assertEqual(cross_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_active_participant_name_cannot_be_reclaimed(self):
        session_id, _, _ = self.create_session("alice")

        response = self.client.post(
            "/api/sessions/join/",
            {"username": " Alice ", "sessionId": session_id.lower()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"]["code"], "participant_name_taken")

    def test_unrevealed_votes_are_private_but_self_vote_is_visible(self):
        session_id, alice_token, _ = self.create_session()
        bob_token, _ = self.join_session(session_id)

        self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"vote": 8},
            format="json",
            **bearer(bob_token),
        )

        alice_view = self.client.get(
            f"/api/sessions/{session_id}/details/",
            **bearer(alice_token),
        )
        bob_view = self.client.get(
            f"/api/sessions/{session_id}/details/",
            **bearer(bob_token),
        )
        self.assertIsNone(alice_view.data["votes"]["bob"]["vote"])
        self.assertTrue(alice_view.data["votes"]["bob"]["has_voted"])
        self.assertEqual(bob_view.data["votes"]["bob"]["vote"], 8)
        self.assertEqual(alice_view.data["vote_results"], {})

    def test_body_username_cannot_change_another_participants_vote(self):
        session_id, alice_token, _ = self.create_session()
        bob_token, _ = self.join_session(session_id)

        response = self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"username": "alice", "vote": 8},
            format="json",
            **bearer(bob_token),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        state = self.client.get(
            f"/api/sessions/{session_id}/details/",
            **bearer(alice_token),
        ).data
        self.assertFalse(state["votes"]["alice"]["has_voted"])
        self.assertTrue(state["votes"]["bob"]["has_voted"])

    def test_non_creator_cannot_administer_session(self):
        session_id, _, _ = self.create_session()
        bob_token, _ = self.join_session(session_id)
        client = APIClient()

        cases = [
            client.post(
                f"/api/sessions/{session_id}/flip_votes/",
                {},
                format="json",
                **bearer(bob_token),
            ),
            client.post(
                f"/api/sessions/{session_id}/reset_votes/",
                {},
                format="json",
                **bearer(bob_token),
            ),
            client.post(
                f"/api/sessions/{session_id}/remove_user/",
                {"username": "alice"},
                format="json",
                **bearer(bob_token),
            ),
            client.delete(
                f"/api/sessions/{session_id}/delete_session/",
                format="json",
                **bearer(bob_token),
            ),
        ]

        self.assertTrue(
            all(response.status_code == status.HTTP_403_FORBIDDEN for response in cases)
        )

    def test_reveal_requires_every_eligible_vote_and_then_exposes_results(self):
        session_id, alice_token, _ = self.create_session()
        bob_token, _ = self.join_session(session_id)
        self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"vote": 5},
            format="json",
            **bearer(alice_token),
        )

        incomplete = self.client.post(
            f"/api/sessions/{session_id}/flip_votes/",
            {},
            format="json",
            **bearer(alice_token),
        )
        self.assertEqual(incomplete.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(incomplete.data["error"]["code"], "votes_incomplete")

        self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"vote": 8},
            format="json",
            **bearer(bob_token),
        )
        revealed = self.client.post(
            f"/api/sessions/{session_id}/flip_votes/",
            {},
            format="json",
            **bearer(alice_token),
        )
        self.assertEqual(revealed.status_code, status.HTTP_200_OK)
        self.assertTrue(revealed.data["session"]["is_revealed"])
        self.assertEqual(revealed.data["session"]["votes"]["bob"]["vote"], 8)
        self.assertEqual(
            revealed.data["session"]["vote_results"]["alice"]["vote"], 5
        )

    def test_spectators_do_not_block_reveal_and_cannot_vote(self):
        session_id, alice_token, _ = self.create_session()
        bob_token, _ = self.join_session(session_id)
        spectator = self.client.post(
            f"/api/sessions/{session_id}/make_spectator/",
            {"is_spectator": True},
            format="json",
            **bearer(bob_token),
        )
        self.assertEqual(spectator.status_code, status.HTTP_200_OK)

        denied = self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"vote": 13},
            format="json",
            **bearer(bob_token),
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"vote": 3},
            format="json",
            **bearer(alice_token),
        )
        revealed = self.client.post(
            f"/api/sessions/{session_id}/flip_votes/",
            {},
            format="json",
            **bearer(alice_token),
        )
        self.assertEqual(revealed.status_code, status.HTTP_200_OK)
        self.assertNotIn("bob", revealed.data["session"]["vote_results"])

    def test_reset_is_authoritative_and_advances_round(self):
        session_id, alice_token, _ = self.create_session()
        self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"vote": 5},
            format="json",
            **bearer(alice_token),
        )
        self.client.post(
            f"/api/sessions/{session_id}/flip_votes/",
            {},
            format="json",
            **bearer(alice_token),
        )

        reset = self.client.post(
            f"/api/sessions/{session_id}/reset_votes/",
            {},
            format="json",
            **bearer(alice_token),
        )

        state = reset.data["session"]
        self.assertEqual(state["round_number"], 2)
        self.assertFalse(state["is_revealed"])
        self.assertEqual(state["vote_results"], {})
        self.assertFalse(state["votes"]["alice"]["has_voted"])

    def test_revealed_round_rejects_further_mutations_until_reset(self):
        session_id, alice_token, _ = self.create_session()
        self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"vote": 5},
            format="json",
            **bearer(alice_token),
        )
        self.client.post(
            f"/api/sessions/{session_id}/flip_votes/",
            {},
            format="json",
            **bearer(alice_token),
        )

        responses = [
            self.client.post(
                f"/api/sessions/{session_id}/cast_vote/",
                {"vote": 8},
                format="json",
                **bearer(alice_token),
            ),
            self.client.post(
                f"/api/sessions/{session_id}/clear_vote/",
                {},
                format="json",
                **bearer(alice_token),
            ),
            self.client.post(
                f"/api/sessions/{session_id}/make_spectator/",
                {"is_spectator": True},
                format="json",
                **bearer(alice_token),
            ),
        ]
        self.assertTrue(
            all(response.status_code == status.HTTP_409_CONFLICT for response in responses)
        )

    def test_remove_revokes_old_capability_and_rejoin_rotates_it(self):
        session_id, alice_token, _ = self.create_session()
        bob_token, _ = self.join_session(session_id)

        removed = self.client.post(
            f"/api/sessions/{session_id}/remove_user/",
            {"username": "bob"},
            format="json",
            **bearer(alice_token),
        )
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertNotIn("bob", removed.data["session"]["participants"])
        self.assertEqual(
            self.client.get(
                f"/api/sessions/{session_id}/details/",
                **bearer(bob_token),
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        new_token, _ = self.join_session(session_id, "bob")
        self.assertNotEqual(new_token, bob_token)
        self.assertEqual(
            self.client.get(
                f"/api/sessions/{session_id}/details/",
                **bearer(new_token),
            ).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get(
                f"/api/sessions/{session_id}/details/",
                **bearer(bob_token),
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_validation_rejects_invalid_votes_names_booleans_and_ids(self):
        session_id, alice_token, _ = self.create_session()

        for invalid_vote in (-1, 0, 4, 21, True, "coffee"):
            response = self.client.post(
                f"/api/sessions/{session_id}/cast_vote/",
                {"vote": invalid_vote},
                format="json",
                **bearer(alice_token),
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        boolean_response = self.client.post(
            f"/api/sessions/{session_id}/make_spectator/",
            {"is_spectator": "false"},
            format="json",
            **bearer(alice_token),
        )
        self.assertEqual(boolean_response.status_code, status.HTTP_400_BAD_REQUEST)

        invalid_name = self.client.post(
            "/api/sessions/create/",
            {"username": "<script>", "session_name": "x"},
            format="json",
        )
        self.assertEqual(invalid_name.status_code, status.HTTP_400_BAD_REQUEST)
        invalid_id = self.client.post(
            "/api/sessions/join/",
            {"username": "bob", "sessionId": "../bad"},
            format="json",
        )
        self.assertEqual(invalid_id.status_code, status.HTTP_400_BAD_REQUEST)

    def test_session_expiry_blocks_reads_and_join(self):
        session_id, alice_token, _ = self.create_session()
        Session.objects.filter(session_id=session_id).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        details = self.client.get(
            f"/api/sessions/{session_id}/details/",
            **bearer(alice_token),
        )
        join = self.client.post(
            "/api/sessions/join/",
            {"username": "bob", "sessionId": session_id},
            format="json",
        )
        self.assertEqual(details.status_code, status.HTTP_410_GONE)
        self.assertEqual(join.status_code, status.HTTP_410_GONE)

    def test_expired_session_cleanup_command(self):
        session_id, _, _ = self.create_session()
        Session.objects.filter(session_id=session_id).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        call_command("purge_expired_sessions", "--dry-run", verbosity=0)
        self.assertTrue(Session.objects.filter(session_id=session_id).exists())

        call_command("purge_expired_sessions", verbosity=0)
        self.assertFalse(Session.objects.filter(session_id=session_id).exists())

    def test_creator_can_delete_without_trusting_request_body_identity(self):
        session_id, alice_token, _ = self.create_session()

        response = self.client.delete(
            f"/api/sessions/{session_id}/delete_session/",
            {"username": "someone-else"},
            format="json",
            **bearer(alice_token),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Session.objects.filter(session_id=session_id).exists())

    def test_creator_cannot_remove_self(self):
        session_id, alice_token, _ = self.create_session()
        response = self.client.post(
            f"/api/sessions/{session_id}/remove_user/",
            {"username": "alice"},
            format="json",
            **bearer(alice_token),
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            response.data["error"]["code"], "creator_cannot_be_removed"
        )

    def test_session_id_collision_is_retried(self):
        existing_id, _, _ = self.create_session("alice")
        with patch(
            "session_management.views.generate_session_id",
            side_effect=[existing_id, "NEW-R00-M01"],
        ):
            new_id, _, _ = self.create_session("bob")
        self.assertEqual(new_id, "NEW-R00-M01")

    def test_unhandled_api_errors_return_generic_json_with_request_id(self):
        with patch(
            "session_management.views.generate_session_id",
            side_effect=RuntimeError("sensitive internal detail"),
        ):
            response = self.client.post(
                "/api/sessions/create/",
                {"username": "alice", "session_name": "Failure contract"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(response.data["error"]["code"], "internal_error")
        self.assertNotIn("sensitive", response.data["error"]["message"])
        self.assertTrue(response.data["error"]["request_id"])

    def test_health_readiness_and_version_are_public(self):
        for path in ("/", "/api/health/", "/api/ready/", "/api/version/"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("X-Request-ID", response)

        landing = self.client.get("/")
        self.assertEqual(landing.json()["service"], "planning-poker-api")
        self.assertEqual(landing.json()["status"], "ready")
        self.assertIn("application", landing.json())

    def test_create_is_rate_limited(self):
        cache.clear()
        with patch.object(
            SessionCreateThrottle,
            "THROTTLE_RATES",
            {
                **SessionCreateThrottle.THROTTLE_RATES,
                "session_create": "2/min",
            },
        ):
            statuses = [
                self.client.post(
                    "/api/sessions/create/",
                    {"username": f"user{index}", "session_name": "Rate test"},
                    format="json",
                ).status_code
                for index in range(3)
            ]
        self.assertEqual(
            statuses,
            [
                status.HTTP_201_CREATED,
                status.HTTP_201_CREATED,
                status.HTTP_429_TOO_MANY_REQUESTS,
            ],
        )

    def test_rotating_signing_key_invalidates_existing_capabilities(self):
        session_id, token, _ = self.create_session()
        with override_settings(SECRET_KEY="rotated-production-key"):
            response = self.client.get(
                f"/api/sessions/{session_id}/details/",
                **bearer(token),
            )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_participant_users_have_unusable_passwords_and_blank_room_names_fail(self):
        self.create_session()
        user = SessionMembership.objects.get(user__username="alice").user
        self.assertFalse(user.has_usable_password())

        response = self.client.post(
            "/api/sessions/create/",
            {"username": "bob", "session_name": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_migrated_model_state_has_one_membership_source(self):
        Session._meta.get_field("vote_results")
        Session._meta.get_field("expires_at")
        self.assertEqual(
            Session._meta.get_field("participants").remote_field.through,
            SessionMembership,
        )
        with self.assertRaises(LookupError):
            apps.get_model("session_management", "UserSession")

    def test_display_name_preserves_original_casing(self):
        _, _, response = self.create_session(username="Alice Smith")
        session = response.data["session"]
        # Identity/lookup key stays casefolded; presentation keeps the original casing.
        self.assertEqual(session["participants"], ["alice smith"])
        self.assertEqual(session["current_user"]["username"], "alice smith")
        self.assertEqual(session["display_names"]["alice smith"], "Alice Smith")
        self.assertEqual(session["created_by_display_name"], "Alice Smith")
        self.assertEqual(session["current_user"]["display_name"], "Alice Smith")

    def test_join_display_name_is_returned_and_updates_on_rejoin(self):
        session_id, _, _ = self.create_session("alice")
        _, join_response = self.join_session(session_id, "Bob Jones")
        self.assertEqual(
            join_response.data["session"]["display_names"]["bob jones"], "Bob Jones"
        )

    @override_settings(SESSION_MAX_PARTICIPANTS=2)
    def test_room_rejects_joins_past_the_participant_cap(self):
        session_id, _, _ = self.create_session("alice")
        self.join_session(session_id, "bob")
        self.client.credentials()
        response = self.client.post(
            "/api/sessions/join/",
            {"username": "carol", "sessionId": session_id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"]["code"], "room_full")

    def test_removed_member_token_cannot_mutate(self):
        session_id, host_token, _ = self.create_session("alice")
        bob_token, _ = self.join_session(session_id, "bob")
        self.client.credentials()
        removal = self.client.post(
            f"/api/sessions/{session_id}/remove_user/",
            {"username": "bob"},
            format="json",
            **bearer(host_token),
        )
        self.assertEqual(removal.status_code, status.HTTP_200_OK, removal.data)

        self.client.credentials()
        vote = self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"vote": 5},
            format="json",
            **bearer(bob_token),
        )
        self.assertEqual(vote.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_expired_session_rejects_mutations(self):
        session_id, token, _ = self.create_session("alice")
        Session.objects.filter(session_id=session_id).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        self.client.credentials()
        response = self.client.post(
            f"/api/sessions/{session_id}/cast_vote/",
            {"vote": 5},
            format="json",
            **bearer(token),
        )
        self.assertEqual(response.status_code, status.HTTP_410_GONE)


@skipUnless(connection.vendor == "postgresql", "PostgreSQL row-lock test")
class ConcurrentVoteTests(TransactionTestCase):
    reset_sequences = True

    def test_simultaneous_votes_are_not_lost(self):
        client = APIClient()
        created = client.post(
            "/api/sessions/create/",
            {"username": "alice", "session_name": "Concurrency"},
            format="json",
        ).data
        session_id = created["session"]["session_id"]
        alice_token = created["participant_token"]
        joined = client.post(
            "/api/sessions/join/",
            {"username": "bob", "sessionId": session_id},
            format="json",
        ).data
        bob_token = joined["participant_token"]

        def vote(token, value):
            close_old_connections()
            try:
                worker = APIClient()
                return worker.post(
                    f"/api/sessions/{session_id}/cast_vote/",
                    {"vote": value},
                    format="json",
                    **bearer(token),
                ).status_code
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(
                executor.map(
                    lambda args: vote(*args),
                    ((alice_token, 5), (bob_token, 8)),
                )
            )

        self.assertEqual(statuses, [status.HTTP_200_OK, status.HTTP_200_OK])
        Session.objects.get(session_id=session_id)
        state = client.get(
            f"/api/sessions/{session_id}/details/",
            **bearer(alice_token),
        ).data
        self.assertTrue(state["votes"]["alice"]["has_voted"])
        self.assertTrue(state["votes"]["bob"]["has_voted"])

    def test_cast_vote_acquires_a_row_lock(self):
        """Deterministic guard: casting a vote must emit SELECT ... FOR UPDATE.

        The two-thread test above only probabilistically exercises the lock; this fails
        immediately if select_for_update() is ever dropped from the vote path.
        """
        client = APIClient()
        created = client.post(
            "/api/sessions/create/",
            {"username": "alice", "session_name": "Locking"},
            format="json",
        ).data
        session_id = created["session"]["session_id"]
        token = created["participant_token"]

        with CaptureQueriesContext(connection) as queries:
            response = client.post(
                f"/api/sessions/{session_id}/cast_vote/",
                {"vote": 5},
                format="json",
                **bearer(token),
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any("FOR UPDATE" in entry["sql"].upper() for entry in queries.captured_queries),
            "cast_vote must lock the session row with select_for_update()",
        )


class LoggingRedactionTests(SimpleTestCase):
    def test_bearer_tokens_and_auth_headers_are_redacted(self):
        from poker_project.logging import JsonFormatter
        import logging as std_logging

        formatter = JsonFormatter()
        secret = "capabilitytokenABCDEF1234567890"
        record = std_logging.LogRecord(
            name="test",
            level=std_logging.ERROR,
            pathname=__file__,
            lineno=1,
            msg="call failed with Authorization: Bearer %s",
            args=(secret,),
            exc_info=None,
        )
        output = formatter.format(record)
        self.assertNotIn(secret, output)
        self.assertIn("[REDACTED]", output)
