import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers

User = get_user_model()
log = logging.getLogger(__name__)
tokens = PasswordResetTokenGenerator()


def public_base(request):
    if settings.PTSMS_PUBLIC_URL:
        return settings.PTSMS_PUBLIC_URL
    origin = request.headers.get("Origin")
    if origin:
        return origin.rstrip("/")
    scheme = "https" if request.is_secure() else "http"
    return f"{scheme}://{request.get_host()}"


def request_reset(email: str, base: str):
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if not user:
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = tokens.make_token(user)
    link = f"{base}/reset-password/{uid}/{token}"
    body = (
        f"A password reset was requested for {user.email}.\n\n"
        f"Open this link to choose a new password:\n{link}\n\n"
        "If you did not ask for this, you can ignore the message."
    )
    try:
        send_mail(
            "Reset your PTSMS password",
            body,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except Exception:
        log.exception("Could not send the password reset email")
        log.info("Password reset link for %s: %s", user.email, link)


def set_password_for_email(email: str, new_password: str):
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if not user:
        raise serializers.ValidationError({"email": "No account uses that email."})
    try:
        validate_password(new_password, user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({"new_password": list(exc.messages)}) from exc
    user.set_password(new_password)
    user.save(update_fields=["password"])


def apply_reset(uid: str, token: str, new_password: str):
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id, is_active=True)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError) as exc:
        raise serializers.ValidationError("This reset link is not valid.") from exc
    if not tokens.check_token(user, token):
        raise serializers.ValidationError("This reset link is not valid or has expired.")
    validate_password(new_password, user)
    user.set_password(new_password)
    user.save(update_fields=["password"])
