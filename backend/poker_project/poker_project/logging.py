import json
import logging
import re
from datetime import datetime, timezone


# Defence in depth: even though no caller is supposed to pass a capability token or auth header to
# a logger, scrub anything token-shaped from messages and tracebacks so a future careless log call
# cannot leak secrets. Matches `Bearer <token>` and `Authorization: ...` style substrings.
_REDACTIONS = (
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=:-]{8,}"),
    re.compile(r"(?i)(authorization[\"']?\s*[:=]\s*[\"']?)[^\s\"',}]+"),
    re.compile(r"(?i)(HTTP_AUTHORIZATION[\"']?\s*[:=]\s*[\"']?)[^\s\"',}]+"),
)


def redact(text):
    if not text:
        return text
    for pattern in _REDACTIONS:
        text = pattern.sub(r"\1[REDACTED]", text)
    return text


class JsonFormatter(logging.Formatter):
    """Small dependency-free JSON formatter for platform log collection."""

    def format(self, record):
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact(record.getMessage()),
        }
        request_id = getattr(record, "request_id", None)
        if request_id:
            payload["request_id"] = request_id
        if record.exc_info:
            payload["exception"] = redact(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False)
