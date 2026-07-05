import re
import secrets
import string


SESSION_ID_PATTERN = re.compile(r"^[A-Z0-9]{3}(?:-[A-Z0-9]{3}){2}$")
SESSION_ID_ALPHABET = string.ascii_uppercase + string.digits


def generate_session_id(length=3, segments=3):
    return "-".join(
        "".join(secrets.choice(SESSION_ID_ALPHABET) for _ in range(length))
        for _ in range(segments)
    )


def canonical_session_id(value):
    normalized = (value or "").strip().upper()
    if not SESSION_ID_PATTERN.fullmatch(normalized):
        return None
    return normalized
