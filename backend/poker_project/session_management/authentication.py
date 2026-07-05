import hashlib
import secrets

from django.conf import settings
from django.core import signing
from django.utils.crypto import constant_time_compare
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .models import SessionMembership


def _digest_nonce(nonce):
    return hashlib.sha256(nonce.encode("utf-8")).hexdigest()


def issue_participant_token(membership):
    nonce = secrets.token_urlsafe(32)
    membership.capability_digest = _digest_nonce(nonce)
    membership.is_active = True
    membership.save(update_fields=("capability_digest", "is_active"))
    return signing.dumps(
        {
            "membership_id": membership.pk,
            "session_id": membership.session.session_id,
            "nonce": nonce,
        },
        key=settings.SECRET_KEY,
        salt=settings.CAPABILITY_SIGNING_SALT,
        compress=True,
    )


class SessionCapabilityAuthentication(BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        raw_header = get_authorization_header(request)
        if not raw_header:
            return None

        parts = raw_header.split()
        if parts[0].lower() != self.keyword.lower().encode("ascii"):
            return None
        if len(parts) != 2:
            raise AuthenticationFailed("Malformed bearer capability")

        try:
            token = parts[1].decode("ascii")
            payload = signing.loads(
                token,
                key=settings.SECRET_KEY,
                salt=settings.CAPABILITY_SIGNING_SALT,
                max_age=settings.CAPABILITY_MAX_AGE_SECONDS,
            )
            membership_id = int(payload["membership_id"])
            session_id = str(payload["session_id"])
            nonce = str(payload["nonce"])
        except signing.SignatureExpired as exc:
            raise AuthenticationFailed("Participant capability has expired") from exc
        except (signing.BadSignature, KeyError, TypeError, ValueError, UnicodeDecodeError) as exc:
            raise AuthenticationFailed("Invalid participant capability") from exc

        try:
            membership = SessionMembership.objects.select_related(
                "user", "session", "session__created_by"
            ).get(pk=membership_id)
        except SessionMembership.DoesNotExist as exc:
            raise AuthenticationFailed("Participant capability has been revoked") from exc

        expected_digest = _digest_nonce(nonce)
        if (
            not membership.is_active
            or not membership.capability_digest
            or membership.session.session_id != session_id
            or not constant_time_compare(membership.capability_digest, expected_digest)
            or not membership.user.is_active
        ):
            raise AuthenticationFailed("Participant capability has been revoked")

        return membership.user, membership

    def authenticate_header(self, request):
        return self.keyword
