from django.contrib import admin
from .models import Session, UserSession


class SessionAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_by', 'created_at')
    search_fields = ('name',)
    list_filter = ('created_at',)


class UserSessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'session', 'joined_at')
    search_fields = ('user__username', 'session__name')
    list_filter = ('joined_at',)


admin.site.register(Session, SessionAdmin)
admin.site.register(UserSession, UserSessionAdmin)
