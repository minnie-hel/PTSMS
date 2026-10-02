"""Media URLs returned to the React app (login, sidebar, settings)."""

from django.conf import settings


def browser_media_url(path: str) -> str:
    """Path the browser loads from the SPA host (Vite/nginx proxies ``/media`` to Django)."""
    if not path:
        return ""
    if path.startswith(("http://", "https://")):
        return path
    if path.startswith("/"):
        return path
    base = settings.MEDIA_URL
    if not base.endswith("/"):
        base = f"{base}/"
    return f"{base}{path.lstrip('/')}"
