from django.core.management.base import BaseCommand

from catalog.models import SafariType

DEFAULT_TYPES = [
    "Luxury safari",
    "Mid-range safari",
    "Budget safari",
]


class Command(BaseCommand):
    help = "Add standard safari types when the list is still empty."

    def handle(self, *args, **options):
        if SafariType.objects.exists():
            self.stdout.write("Safari types already exist.")
            return
        for name in DEFAULT_TYPES:
            SafariType.objects.create(name=name)
        self.stdout.write(self.style.SUCCESS(f"Added {len(DEFAULT_TYPES)} safari types."))
