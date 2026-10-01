from common.models import AuditLog


def audit(user, action, instance, message):
    AuditLog.objects.create(
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        entity_type=instance._meta.model_name,
        entity_id=str(instance.pk),
        message=message,
    )
