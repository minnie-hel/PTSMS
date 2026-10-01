import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import Permission
from accounts.permissions_catalog import PERMISSIONS

User = get_user_model()


class Command(BaseCommand):
    help = "Create the first super admin when none exists, and refresh permission codes."

    def handle(self, *args, **options):
        for code, label, module in PERMISSIONS:
            Permission.objects.update_or_create(
                code=code, defaults={"label": label, "module": module}
            )

        if User.objects.filter(is_superadmin=True).exists():
            self.stdout.write("A super admin already exists.")
            return

        email = os.environ.get("PTSMS_ADMIN_EMAIL", "admin@paultours.local")
        password = os.environ.get("PTSMS_ADMIN_PASSWORD", "PaulTours#2026")
        User.objects.create_superuser(
            email=email,
            password=password,
            full_name="Super Admin",
        )
        self.stdout.write(self.style.SUCCESS(f"Super admin created: {email}"))
