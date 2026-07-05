import logging

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .authentication import issue_participant_token
from .exceptions import Conflict, Gone
from .models import Session, SessionMembership
from .serializers import (
    CastVoteSerializer,
    CreateSessionSerializer,
    JoinSessionSerializer,
    RemoveParticipantSerializer,
    SpectatorSerializer,
    VALID_VOTES,
)
from .throttles import SessionCreateThrottle, SessionJoinThrottle
from .utils import canonical_session_id, generate_session_id


User = get_user_model()
audit_logger = logging.getLogger("session_management.audit")


def _error_message(message, code):
    return {"error": {"code": code, "message": message}}


def _participant_user(username):
    user, created = User.objects.get_or_create(username=username)
    if created:
        user.set_unusable_password()
        user.save(update_fields=("password",))
    return user


def _session_or_404(session_id, *, for_update=False):
    normalized = canonical_session_id(session_id)
    if not normalized:
        raise NotFound("Session not found")
    queryset = Session.objects
    if for_update:
        queryset = queryset.select_for_update()
    try:
        return queryset.select_related("created_by").get(session_id=normalized)
    except Session.DoesNotExist as exc:
        raise NotFound("Session not found") from exc


def _membership_for(request, session, *, for_update=False):
    authenticated_membership = request.auth
    if (
        not isinstance(authenticated_membership, SessionMembership)
        or authenticated_membership.session_id != session.pk
    ):
        raise PermissionDenied("This capability does not grant access to this session")

    queryset = SessionMembership.objects
    if for_update:
        queryset = queryset.select_for_update()
    try:
        membership = queryset.select_related("user", "session").get(
            pk=authenticated_membership.pk,
            session=session,
            is_active=True,
        )
    except SessionMembership.DoesNotExist as exc:
        raise PermissionDenied("Session membership is no longer active") from exc

    if session.expires_at <= timezone.now():
        raise Gone()
    return membership


def _require_creator(membership, session):
    if membership.user_id != session.created_by_id:
        raise PermissionDenied("Only the session creator can perform this action")


def _vote_value(votes, username):
    state = votes.get(username, {})
    if isinstance(state, dict):
        value = state.get("vote")
    else:
        value = state
    return value if value in VALID_VOTES else None


def _serialize_session(session, current_membership):
    members = list(
        session.memberships.filter(is_active=True)
        .select_related("user")
        .order_by("joined_at", "pk")
    )
    votes = session.votes or {}
    visible_votes = {}

    for member in members:
        username = member.user.username
        value = _vote_value(votes, username)
        can_view_value = session.is_revealed or member.pk == current_membership.pk
        visible_votes[username] = {
            "vote": value if can_view_value else None,
            "is_spectator": member.is_spectator,
            "has_voted": value is not None,
        }

    vote_results = {}
    if session.is_revealed:
        stored_results = session.vote_results or {}
        for member in members:
            if member.is_spectator:
                continue
            username = member.user.username
            result = stored_results.get(username)
            if isinstance(result, dict):
                value = result.get("vote")
            else:
                value = result
            if value in VALID_VOTES:
                vote_results[username] = {
                    "vote": value,
                    "is_spectator": False,
                }

    return {
        "session_id": session.session_id,
        "name": session.name,
        "created_by": session.created_by.username,
        "participants": [member.user.username for member in members],
        "votes": visible_votes,
        "vote_results": vote_results,
        "round_number": session.round_number,
        "is_revealed": session.is_revealed,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "expires_at": session.expires_at,
        "current_user": {
            "username": current_membership.user.username,
            "is_creator": current_membership.user_id == session.created_by_id,
            "is_spectator": current_membership.is_spectator,
        },
    }


def _audit(request, action, session, membership):
    audit_logger.info(
        "action=%s session_id=%s actor_membership_id=%s",
        action,
        session.session_id,
        membership.pk,
        extra={"request_id": getattr(request, "request_id", None)},
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SessionCreateThrottle])
def create_session(request):
    serializer = CreateSessionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data["username"]
    session_name = serializer.validated_data["session_name"]

    with transaction.atomic():
        user = _participant_user(username)
        session = None
        for _ in range(5):
            try:
                with transaction.atomic():
                    session = Session.objects.create(
                        name=session_name,
                        created_by=user,
                        session_id=generate_session_id(),
                        votes={},
                        vote_results={},
                    )
                break
            except IntegrityError:
                continue
        if session is None:
            return Response(
                _error_message(
                    "Could not allocate a unique session ID; please retry",
                    "session_id_exhausted",
                ),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        membership = SessionMembership.objects.create(session=session, user=user)
        session.votes = {
            username: {"vote": None, "is_spectator": False},
        }
        session.save(update_fields=("votes", "updated_at"))
        participant_token = issue_participant_token(membership)

    _audit(request, "session.created", session, membership)
    return Response(
        {
            "message": "Session created successfully",
            "participant_token": participant_token,
            "session": _serialize_session(session, membership),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SessionJoinThrottle])
def join_session(request):
    serializer = JoinSessionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data["username"]
    session_id = serializer.validated_data["sessionId"]

    with transaction.atomic():
        session = _session_or_404(session_id, for_update=True)
        if session.expires_at <= timezone.now():
            raise Gone()

        user = _participant_user(username)
        membership = (
            SessionMembership.objects.select_for_update()
            .filter(session=session, user=user)
            .first()
        )
        if membership and membership.is_active:
            raise Conflict(
                "That participant name is already active in this session",
                code="participant_name_taken",
            )
        if membership and user.pk == session.created_by_id:
            raise Conflict(
                "The legacy creator capability cannot be reclaimed; create a new session",
                code="creator_capability_unavailable",
            )

        if membership:
            membership.is_active = True
            membership.is_spectator = False
            membership.save(update_fields=("is_active", "is_spectator"))
        else:
            membership = SessionMembership.objects.create(
                session=session,
                user=user,
            )

        votes = dict(session.votes or {})
        votes[username] = {"vote": None, "is_spectator": False}
        session.votes = votes
        session.save(update_fields=("votes", "updated_at"))
        participant_token = issue_participant_token(membership)

    _audit(request, "participant.joined", session, membership)
    return Response(
        {
            "message": "Joined session successfully",
            "participant_token": participant_token,
            "session": _serialize_session(session, membership),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
def cast_vote(request, session_id):
    serializer = CastVoteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    with transaction.atomic():
        session = _session_or_404(session_id, for_update=True)
        membership = _membership_for(request, session, for_update=True)
        if session.is_revealed:
            raise Conflict(
                "Reset the revealed round before voting again",
                code="round_already_revealed",
            )
        if membership.is_spectator:
            raise PermissionDenied("Spectators cannot vote")

        votes = dict(session.votes or {})
        votes[membership.user.username] = {
            "vote": serializer.validated_data["vote"],
            "is_spectator": False,
        }
        session.votes = votes
        session.vote_results = {}
        session.save(update_fields=("votes", "vote_results", "updated_at"))

    _audit(request, "vote.cast", session, membership)
    return Response(
        {
            "message": "Vote recorded successfully",
            "session": _serialize_session(session, membership),
        }
    )


@api_view(["POST"])
def clear_vote(request, session_id):
    with transaction.atomic():
        session = _session_or_404(session_id, for_update=True)
        membership = _membership_for(request, session, for_update=True)
        if session.is_revealed:
            raise Conflict(
                "Reset the revealed round before clearing a vote",
                code="round_already_revealed",
            )

        votes = dict(session.votes or {})
        votes[membership.user.username] = {
            "vote": None,
            "is_spectator": membership.is_spectator,
        }
        session.votes = votes
        session.vote_results = {}
        session.save(update_fields=("votes", "vote_results", "updated_at"))

    _audit(request, "vote.cleared", session, membership)
    return Response(
        {
            "message": "Vote cleared successfully",
            "session": _serialize_session(session, membership),
        }
    )


@api_view(["POST"])
def flip_votes(request, session_id):
    with transaction.atomic():
        session = _session_or_404(session_id, for_update=True)
        membership = _membership_for(request, session, for_update=True)
        _require_creator(membership, session)
        if session.is_revealed:
            raise Conflict("Votes are already revealed", code="round_already_revealed")

        eligible_members = list(
            SessionMembership.objects.select_for_update()
            .filter(session=session, is_active=True, is_spectator=False)
            .select_related("user")
        )
        if not eligible_members:
            raise Conflict("There are no eligible voters", code="no_eligible_voters")

        votes = session.votes or {}
        missing = [
            member.user.username
            for member in eligible_members
            if _vote_value(votes, member.user.username) is None
        ]
        if missing:
            raise Conflict(
                "Every non-spectator participant must vote before reveal",
                code="votes_incomplete",
            )

        session.vote_results = {
            member.user.username: {
                "vote": _vote_value(votes, member.user.username),
                "is_spectator": False,
            }
            for member in eligible_members
        }
        session.is_revealed = True
        session.save(
            update_fields=("vote_results", "is_revealed", "updated_at")
        )

    _audit(request, "round.revealed", session, membership)
    return Response(
        {
            "message": "Votes revealed successfully",
            "session": _serialize_session(session, membership),
        }
    )


@api_view(["POST"])
def reset_votes(request, session_id):
    with transaction.atomic():
        session = _session_or_404(session_id, for_update=True)
        membership = _membership_for(request, session, for_update=True)
        _require_creator(membership, session)
        members = list(
            SessionMembership.objects.select_for_update()
            .filter(session=session, is_active=True)
            .select_related("user")
        )

        session.votes = {
            member.user.username: {
                "vote": None,
                "is_spectator": member.is_spectator,
            }
            for member in members
        }
        session.vote_results = {}
        session.is_revealed = False
        session.round_number += 1
        session.save(
            update_fields=(
                "votes",
                "vote_results",
                "is_revealed",
                "round_number",
                "updated_at",
            )
        )

    _audit(request, "round.reset", session, membership)
    return Response(
        {
            "message": "Votes reset successfully",
            "session": _serialize_session(session, membership),
        }
    )


@api_view(["GET"])
def get_session_details(request, session_id):
    session = _session_or_404(session_id)
    membership = _membership_for(request, session)
    return Response(_serialize_session(session, membership))


@api_view(["POST"])
def make_spectator(request, session_id):
    serializer = SpectatorSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    with transaction.atomic():
        session = _session_or_404(session_id, for_update=True)
        membership = _membership_for(request, session, for_update=True)
        if session.is_revealed:
            raise Conflict(
                "Reset the revealed round before changing participant status",
                code="round_already_revealed",
            )

        is_spectator = serializer.validated_data["is_spectator"]
        membership.is_spectator = is_spectator
        membership.save(update_fields=("is_spectator",))

        votes = dict(session.votes or {})
        current_vote = None if is_spectator else _vote_value(
            votes, membership.user.username
        )
        votes[membership.user.username] = {
            "vote": current_vote,
            "is_spectator": is_spectator,
        }
        session.votes = votes
        session.vote_results = {}
        session.save(update_fields=("votes", "vote_results", "updated_at"))

    _audit(request, "participant.status_changed", session, membership)
    return Response(
        {
            "message": "Participant status updated",
            "session": _serialize_session(session, membership),
        }
    )


@api_view(["POST"])
def remove_user(request, session_id):
    serializer = RemoveParticipantSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data["username"]

    with transaction.atomic():
        session = _session_or_404(session_id, for_update=True)
        membership = _membership_for(request, session, for_update=True)
        _require_creator(membership, session)

        target = (
            SessionMembership.objects.select_for_update()
            .filter(
                session=session,
                user__username=username,
                is_active=True,
            )
            .select_related("user")
            .first()
        )
        if target is None:
            raise NotFound("Participant not found")
        if target.user_id == session.created_by_id:
            raise Conflict(
                "The session creator cannot be removed",
                code="creator_cannot_be_removed",
            )

        target.is_active = False
        target.capability_digest = ""
        target.save(update_fields=("is_active", "capability_digest"))

        votes = dict(session.votes or {})
        votes.pop(username, None)
        results = dict(session.vote_results or {})
        results.pop(username, None)
        session.votes = votes
        session.vote_results = results
        session.save(update_fields=("votes", "vote_results", "updated_at"))

    _audit(request, "participant.removed", session, membership)
    return Response(
        {
            "message": f"{username} was removed from the session",
            "session": _serialize_session(session, membership),
        }
    )


@api_view(["DELETE"])
def delete_session(request, session_id):
    with transaction.atomic():
        session = _session_or_404(session_id, for_update=True)
        membership = _membership_for(request, session, for_update=True)
        _require_creator(membership, session)
        session_label = session.session_id
        actor_membership_id = membership.pk
        session.delete()

    audit_logger.info(
        "action=session.deleted session_id=%s actor_membership_id=%s",
        session_label,
        actor_membership_id,
        extra={"request_id": getattr(request, "request_id", None)},
    )
    return Response({"message": "Session deleted successfully"})
