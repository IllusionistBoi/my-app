"""Django settings for the planning poker API."""

import os
import sys
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent
TESTING = any(argument == "test" or argument.startswith("test_") for argument in sys.argv)


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ImproperlyConfigured(f"{name} must be a boolean value")


def env_list(name, default=()):
    value = os.environ.get(name)
    if value is None:
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "").strip()
if not SECRET_KEY:
    if DEBUG or TESTING:
        SECRET_KEY = "development-only-key-change-me-before-production"
    else:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false")

ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    ("localhost", "127.0.0.1", "[::1]", "testserver") if DEBUG or TESTING else (),
)
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must contain at least one production host")


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sessions",
    "corsheaders",
    "rest_framework",
    "session_management",
]

MIDDLEWARE = [
    "poker_project.middleware.RequestIDMiddleware",
    "poker_project.middleware.PrivateAPINoStoreMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "poker_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "poker_project.wsgi.application"
ASGI_APPLICATION = "poker_project.asgi.application"


DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=int(os.environ.get("DB_CONN_MAX_AGE", "60")),
            conn_health_checks=True,
            ssl_require=env_bool("DB_SSL_REQUIRED", not DEBUG and not TESTING),
        )
    }
elif DEBUG or TESTING:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    raise ImproperlyConfigured("DATABASE_URL is required when DJANGO_DEBUG is false")


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# Throttle counters must survive across Vercel's separate serverless instances and cold
# starts, so the default per-process LocMemCache is unusable. Use a database-backed cache on
# the existing Neon Postgres (no paid Redis/KV). The table is created by migration
# session_management.0010_cache_table (createcachetable), so no manual setup step is needed.
# In-memory local cache is fine when there is no database (pure unit tests without DB access).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "poker_cache_table",
        "TIMEOUT": 3600,
        "OPTIONS": {"MAX_ENTRIES": 20000, "CULL_FREQUENCY": 4},
    }
}


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "session_management.authentication.SessionCapabilityAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    # No blanket anon/user throttle: with a DB-backed cache, a global throttle would write to
    # the DB on every request, including the frontend's periodic room poll, needlessly burning
    # Neon capacity. The abuse-sensitive unauthenticated entry points (create/join) keep their
    # own IP-scoped throttles applied per view; authenticated mutations are capability-gated and
    # self-scoped.
    "DEFAULT_THROTTLE_CLASSES": (),
    "DEFAULT_THROTTLE_RATES": {
        "session_create": os.environ.get("API_SESSION_CREATE_RATE", "20/hour"),
        "session_join": os.environ.get("API_SESSION_JOIN_RATE", "60/hour"),
    },
    "NUM_PROXIES": int(os.environ.get("API_NUM_PROXIES", "0" if DEBUG or TESTING else "1")),
    "EXCEPTION_HANDLER": "session_management.exceptions.api_exception_handler",
}

SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", str(7 * 24 * 60 * 60)))
SESSION_MAX_PARTICIPANTS = int(os.environ.get("SESSION_MAX_PARTICIPANTS", "50"))
CAPABILITY_MAX_AGE_SECONDS = int(
    os.environ.get("CAPABILITY_MAX_AGE_SECONDS", str(30 * 24 * 60 * 60))
)
CAPABILITY_SIGNING_SALT = "planning-poker.session-capability.v1"

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )
    if DEBUG
    else (),
)
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", not DEBUG and not TESTING)
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "0" if DEBUG else "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("DJANGO_HSTS_INCLUDE_SUBDOMAINS", not DEBUG)
SECURE_HSTS_PRELOAD = env_bool("DJANGO_HSTS_PRELOAD", not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

DEPLOYMENT_COMMIT = (
    os.environ.get("VERCEL_GIT_COMMIT_SHA")
    or os.environ.get("GIT_COMMIT")
    or "unknown"
)
DEPLOYMENT_ENVIRONMENT = os.environ.get("DEPLOYMENT_ENVIRONMENT", "development" if DEBUG else "production")
PUBLIC_APP_URL = os.environ.get(
    "PUBLIC_APP_URL",
    "https://planning-poker-ronit.vercel.app",
)

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "poker_project.logging.JsonFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "django.server": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
    },
}
