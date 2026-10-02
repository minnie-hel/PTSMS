from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from catalog.logo import warm_logo_variants
from catalog.models import CompanyProfile

DEFAULT_LOGO = Path(__file__).resolve().parents[4] / "assets" / "company-logo.png"
DEFAULT_NAME = "Paul Tours Safari"


class Command(BaseCommand):
    help = "Store the company logo and brand colors in the database when they are not set yet."

    def add_arguments(self, parser):
        parser.add_argument(
            "--logo",
            type=str,
            default="",
            help=f"Logo image file (default: {DEFAULT_LOGO})",
        )
        parser.add_argument(
            "--force-logo",
            action="store_true",
            help="Replace the stored logo even if one is already saved.",
        )

    def handle(self, *args, **options):
        profile = CompanyProfile.load()
        updated = []

        if not profile.primary_color:
            profile.primary_color = "#2E3192"
            updated.append("primary_color")
        if not profile.secondary_color:
            profile.secondary_color = "#F7941D"
            updated.append("secondary_color")
        if not profile.name:
            profile.name = DEFAULT_NAME
            updated.append("name")
        if not profile.welcome_title:
            profile.welcome_title = f"Welcome to {profile.name or DEFAULT_NAME}"
            updated.append("welcome_title")

        logo_path = Path(options["logo"] or DEFAULT_LOGO)
        want_logo = options["force_logo"] or not profile.logo
        if want_logo and logo_path.is_file():
            with logo_path.open("rb") as handle:
                profile.logo.save(logo_path.name, File(handle), save=False)
            updated.append("logo")
        elif want_logo and not logo_path.is_file():
            self.stderr.write(self.style.ERROR(f"Logo file not found: {logo_path}"))

        if updated:
            profile.save()
            if profile.logo:
                warm_logo_variants(profile)
            self.stdout.write(self.style.SUCCESS(f"Updated company profile: {', '.join(updated)}"))
        else:
            self.stdout.write("Company branding already set in the database.")
