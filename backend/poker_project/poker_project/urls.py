from django.contrib import admin
from django.urls import include, path

from . import views


urlpatterns = [
    path("", views.landing, name="landing"),
    path("admin/", admin.site.urls),
    path("api/health/", views.health, name="health"),
    path("api/ready/", views.readiness, name="readiness"),
    path("api/version/", views.version, name="version"),
    path("api/sessions/", include("session_management.urls")),
]
