import re

from rest_framework import serializers

from .utils import canonical_session_id


VALID_VOTES = (1, 2, 3, 5, 8, 13)
USERNAME_PATTERN = re.compile(r"^[\w.@+\- ]+$", re.UNICODE)


def normalize_username(value):
    normalized = " ".join(value.split()).casefold()
    if not normalized or not USERNAME_PATTERN.fullmatch(normalized):
        raise serializers.ValidationError(
            "Use letters, numbers, spaces, or . @ + - _ only"
        )
    return normalized


class StrictBooleanField(serializers.BooleanField):
    def to_internal_value(self, data):
        if type(data) is not bool:
            self.fail("invalid", input=data)
        return data


class CreateSessionSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=1, max_length=50)
    session_name = serializers.CharField(min_length=1, max_length=100)

    def validate_username(self, value):
        return normalize_username(value)

    def validate_session_name(self, value):
        normalized = " ".join(value.split())
        if not normalized:
            raise serializers.ValidationError("Session name cannot be blank")
        return normalized


class JoinSessionSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=1, max_length=50)
    sessionId = serializers.CharField(min_length=1, max_length=20)

    def validate_username(self, value):
        return normalize_username(value)

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
