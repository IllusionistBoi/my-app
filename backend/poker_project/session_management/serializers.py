import re

from rest_framework import serializers

from .utils import canonical_session_id


VALID_VOTES = (1, 2, 3, 5, 8, 13)
USERNAME_PATTERN = re.compile(r"^[\w.@+\- ]+$", re.UNICODE)


def split_username(value):
    """Return (canonical, display) for a raw username.

    canonical is casefolded and used as the identity/lookup key; display keeps the original
    casing (whitespace-collapsed) for presentation.
    """
    display = " ".join(value.split())
    canonical = display.casefold()
    if not canonical or not USERNAME_PATTERN.fullmatch(canonical):
        raise serializers.ValidationError(
            "Use letters, numbers, spaces, or . @ + - _ only"
        )
    return canonical, display


def normalize_username(value):
    return split_username(value)[0]


class _DisplayNameMixin:
    """Expose the original-case display name for the validated `username` field."""

    def validate_username(self, value):
        canonical, display = split_username(value)
        self._display_name = display
        return canonical

    def validate(self, attrs):
        attrs = super().validate(attrs)
        attrs["display_name"] = getattr(self, "_display_name", attrs.get("username", ""))
        return attrs


class StrictBooleanField(serializers.BooleanField):
    def to_internal_value(self, data):
        if type(data) is not bool:
            self.fail("invalid", input=data)
        return data


class CreateSessionSerializer(_DisplayNameMixin, serializers.Serializer):
    username = serializers.CharField(min_length=1, max_length=50)
    session_name = serializers.CharField(min_length=1, max_length=100)

    def validate_session_name(self, value):
        normalized = " ".join(value.split())
        if not normalized:
            raise serializers.ValidationError("Session name cannot be blank")
        return normalized


class JoinSessionSerializer(_DisplayNameMixin, serializers.Serializer):
    username = serializers.CharField(min_length=1, max_length=50)
    sessionId = serializers.CharField(min_length=1, max_length=20)

    def validate_sessionId(self, value):
        normalized = canonical_session_id(value)
        if not normalized:
            raise serializers.ValidationError("Invalid session ID")
        return normalized


class CastVoteSerializer(serializers.Serializer):
    vote = serializers.ChoiceField(choices=VALID_VOTES)


class SpectatorSerializer(serializers.Serializer):
    is_spectator = StrictBooleanField()


class RemoveParticipantSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=1, max_length=50)

    def validate_username(self, value):
        return normalize_username(value)
