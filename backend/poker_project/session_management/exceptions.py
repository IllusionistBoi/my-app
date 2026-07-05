import logging

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler


logger = logging.getLogger(__name__)


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The request conflicts with the current session state"
    default_code = "conflict"


class Gone(APIException):
    status_code = status.HTTP_410_GONE
    default_detail = "This session has expired"
    default_code = "session_expired"


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get("request")
    request_id = getattr(request, "request_id", None)

    if response is None:
        logger.exception(
            "Unhandled API exception",
            exc_info=(type(exc), exc, exc.__traceback__),
            extra={"request_id": request_id},
        )
        error = {
            "code": "internal_error",
            "message": "The server could not complete the request.",
        }
        if request_id:
            error["request_id"] = request_id
        return Response(
            {"error": error},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    original = response.data
    codes = exc.get_codes() if hasattr(exc, "get_codes") else "api_error"

    if isinstance(original, dict) and set(original) == {"detail"}:
        message = str(original["detail"])
        code = codes if isinstance(codes, str) else "api_error"
        details = None
    else:
        message = "Request validation failed"
        code = "validation_error"
        details = original

    error = {"code": code, "message": message}
    if details is not None:
        error["details"] = details

    if request_id:
        error["request_id"] = request_id

    response.data = {"error": error}
    return response
