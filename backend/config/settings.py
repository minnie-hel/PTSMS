import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env_file():
    env_path = BASE_DIR / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _csv(name, default=""):
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _truthy(name, default="0"):
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


_load_env_file()

SECRET_KEY = os.environ.get("PTSMS_SECRET_KEY", "dev-only-ptsms-change-this-key")
DEBUG = _truthy("PTSMS_DEBUG", "1")
ALLOWED_HOSTS = _csv("PTSMS_ALLOWED_HOSTS", "localhost,127.0.0.1")
if not DEBUG and SECRET_KEY in {"", "dev-only-ptsms-change-this-key", "change-me-in-production"}:
    raise ImproperlyConfigured("Set PTSMS_SECRET_KEY to a long random value when PTSMS_DEBUG=0.")
if not DEBUG and not ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set PTSMS_ALLOWED_HOSTS when PTSMS_DEBUG=0.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "django_filters",
    "common",
    "accounts",
    "catalog",
    "crm",
    "vendors",
    "bookings",
    "finance",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

def _database_settings():
    engine = os.environ.get("PTSMS_DB_ENGINE", "postgresql").lower()
    if engine in ("sqlite", "sqlite3"):
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.environ.get("PTSMS_DB_NAME", str(BASE_DIR / "db.sqlite3")),
        }
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("PTSMS_DB_NAME", "safari"),
        "USER": os.environ.get("PTSMS_DB_USER", "postgres"),
        "PASSWORD": os.environ.get("PTSMS_DB_PASSWORD", ""),
        "HOST": os.environ.get("PTSMS_DB_HOST", "127.0.0.1"),
        "PORT": os.environ.get("PTSMS_DB_PORT", "5432"),
        "CONN_MAX_AGE": int(os.environ.get("PTSMS_DB_CONN_MAX_AGE", "60")),
        "OPTIONS": {},
    }


DATABASES = {"default": _database_settings()}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Dar_es_Salaam"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = Path(os.environ.get("PTSMS_STATIC_ROOT", BASE_DIR / "staticfiles"))
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("PTSMS_MEDIA_ROOT", BASE_DIR / "media"))
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

CORS_ALLOWED_ORIGINS = _csv(
    "PTSMS_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CSRF_TRUSTED_ORIGINS = _csv(
    "PTSMS_CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if _truthy("PTSMS_HTTPS", "0"):
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = _truthy("PTSMS_SSL_REDIRECT", "0")
    SECURE_HSTS_SECONDS = int(os.environ.get("PTSMS_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = False

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=12),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}
