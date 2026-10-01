from django.apps import AppConfig
from django.db.models.signals import post_migrate


def seed_permissions(sender, **kwargs):
    from accounts.models import Permission
    from accounts.permissions_catalog import PERMISSIONS

    for code, label, module in PERMISSIONS:
        Permission.objects.update_or_create(
            code=code, defaults={"label": label, "module": module}
        )


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        post_migrate.connect(seed_permissions, sender=self)
