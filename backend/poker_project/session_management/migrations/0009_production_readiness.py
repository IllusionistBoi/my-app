import session_management.models
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


def migrate_memberships(apps, schema_editor):
    Session = apps.get_model("session_management", "Session")
    SessionMembership = apps.get_model("session_management", "SessionMembership")
    UserSession = apps.get_model("session_management", "UserSession")
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))

    joined_at_by_member = {
        (row.session_id, row.user_id): row.joined_at
        for row in UserSession.objects.all().iterator()
    }

    for session in Session.objects.all().iterator():
        user_ids = set(session.participants.values_list("id", flat=True))
        user_ids.add(session.created_by_id)
        votes = session.votes or {}

        for user_id in user_ids:
            username = (
                User.objects.filter(pk=user_id)
                .values_list("username", flat=True)
                .first()
            )
            vote_state = votes.get(username, {}) if username else {}
            if not isinstance(vote_state, dict):
                vote_state = {}
            membership = SessionMembership.objects.create(
                session_id=session.pk,
                user_id=user_id,
                is_spectator=bool(vote_state.get("is_spectator", False)),
                is_active=True,
                capability_digest="",
            )
            joined_at = joined_at_by_member.get((session.pk, user_id))
            if joined_at:
                SessionMembership.objects.filter(pk=membership.pk).update(
                    joined_at=joined_at
                )


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("session_management", "0008_session_participants"),
    ]

    operations = [
        migrations.AddField(
            model_name="session",
            name="expires_at",
            field=models.DateTimeField(
                db_index=True,
                default=session_management.models.default_session_expiry,
            ),
        ),
        migrations.AddField(
            model_name="session",
            name="is_revealed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="session",
            name="round_number",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="session",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="session",
            name="vote_results",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.CreateModel(
            name="SessionMembership",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("is_spectator", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("capability_digest", models.CharField(blank=True, max_length=64)),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="session_management.session",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="poker_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.RunPython(migrate_memberships, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="session",
            name="participants",
        ),
        migrations.AddField(
            model_name="session",
            name="participants",
            field=models.ManyToManyField(
                blank=True,
                related_name="poker_sessions",
                through="session_management.SessionMembership",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddConstraint(
            model_name="sessionmembership",
            constraint=models.UniqueConstraint(
                fields=("user", "session"),
                name="unique_user_session_membership",
            ),
        ),
        migrations.AddIndex(
            model_name="sessionmembership",
            index=models.Index(
                fields=["session", "is_active"],
                name="session_member_active_idx",
            ),
        ),
        migrations.DeleteModel(
            name="UserSession",
        ),
    ]
