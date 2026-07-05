from django.contrib import admin

from .models import Session, SessionMembership


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "session_id",
        "created_by",
        "round_number",
        "is_revealed",
        "created_at",
        "expires_at",
    )
    search_fields = ("name", "session_id", "created_by__username")
    list_filter = ("is_revealed", "created_at", "expires_at")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SessionMembership)
class SessionMembershipAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "session",
        "is_spectator",
        "is_active",
        "joined_at",
    )
    search_fields = ("user__username", "session__name", "session__session_id")
    list_filter = ("is_spectator", "is_active", "joined_at")
    readonly_fields = ("capability_digest", "joined_at")
