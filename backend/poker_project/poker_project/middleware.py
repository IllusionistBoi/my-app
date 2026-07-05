import re
import secrets


REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{8,128}$")


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        supplied = request.headers.get("X-Request-ID", "")
        request.request_id = (
            supplied if REQUEST_ID_PATTERN.fullmatch(supplied) else secrets.token_hex(16)
        )
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        return response


class PrivateAPINoStoreMiddleware:
    """Prevent capability-bearing room responses from entering shared caches."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/sessions/"):
            response["Cache-Control"] = "no-store, private"
            response["Pragma"] = "no-cache"
        return response
