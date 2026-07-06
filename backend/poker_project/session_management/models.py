from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone


User = get_user_model()


def default_session_expiry():
    return timezone.now() + timedelta(seconds=settings.SESSION_TTL_SECONDS)


class Session(models.Model):
    session_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(default=default_session_expiry, db_index=True)
    participants = models.ManyToManyField(
        User,
        related_name="poker_sessions",
        through="SessionMembership",
        blank=True,
    )
    votes = models.JSONField(default=dict)
    vote_results = models.JSONField(default=dict, blank=True)
    round_number = models.PositiveIntegerField(default=1)
    is_revealed = models.BooleanField(default=False)

    def __str__(self):
        return self.name

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()


class SessionMembership(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="poker_memberships",
    )
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    is_spectator = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    capability_digest = models.CharField(max_length=64, blank=True)
    display_name = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "session"),
                name="unique_user_session_membership",
            )
        ]
        indexes = [
            models.Index(
                fields=("session", "is_active"),
                name="session_member_active_idx",
            )
        ]

    def __str__(self):
        return f"{self.user.username} in {self.session.name}"

    @property
    def is_creator(self):
        return self.session.created_by_id == self.user_id
