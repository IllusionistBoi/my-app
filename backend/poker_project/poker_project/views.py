import logging

from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


logger = logging.getLogger(__name__)


@require_GET
@never_cache
def landing(request):
    return JsonResponse(
        {
            "service": "planning-poker-api",
            "status": "ready",
            "message": "This backend powers the Planning Poker browser application.",
            "application": settings.PUBLIC_APP_URL,
            "readiness": request.build_absolute_uri("/api/ready/"),
        }
    )


@require_GET
@never_cache
def health(request):
    return JsonResponse(
        {
            "status": "ok",
            "service": "planning-poker-api",
            "version": settings.DEPLOYMENT_COMMIT,
        }
    )


@require_GET
@never_cache
def readiness(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        logger.exception(
            "Database readiness check failed",
            extra={"request_id": getattr(request, "request_id", None)},
        )
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ready"})


@require_GET
@never_cache
def version(request):
    return JsonResponse(
        {
            "service": "planning-poker-api",
            "version": settings.DEPLOYMENT_COMMIT,
            "environment": settings.DEPLOYMENT_ENVIRONMENT,
        }
    )
