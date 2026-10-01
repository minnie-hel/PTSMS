from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from catalog.models import CompanyProfile

DEFAULT_LOGO = Path(__file__).resolve().parents[4] / "assets" / "company-logo.png"


class Command(BaseCommand):
    help = "Store the company logo and brand colors in the database when they are not set yet."

    def handle(self, *args, **options):
        profile = CompanyProfile.load()
        updated = []

        if not profile.primary_color:
            profile.primary_color = "#2E3192"
            updated.append("primary_color")
        if not profile.secondary_color:
            profile.secondary_color = "#F7941D"
            updated.append("secondary_color")
        if not profile.welcome_title:
            profile.welcome_title = "Welcome Paul Tours Safari"
            updated.append("welcome_title")

        logo_path = Path(options.get("logo") or DEFAULT_LOGO)
        if not profile.logo and logo_path.is_file():
            with logo_path.open("rb") as handle:
                profile.logo.save(logo_path.name, File(handle), save=False)
            updated.append("logo")

        if updated:
            profile.save()
            self.stdout.write(self.style.SUCCESS(f"Updated company profile: {', '.join(updated)}"))
        else:
            self.stdout.write("Company branding already set in the database.")
