from django.core.management.base import BaseCommand

from accounts.models import Permission, Role
from accounts.permissions_catalog import PERMISSIONS, expand_codes
from catalog.models import ClientType, Destination, ExpenseCategory, LeadSource, PaymentMethod, SafariType


LEAD_SOURCES = [
    "Website",
    "WhatsApp",
    "Instagram",
    "Facebook",
    "Google",
    "Email",
    "Referral",
    "Travel Agent",
    "Walk-in",
    "Returning Client",
    "Other",
]

CLIENT_TYPES = [
    "Individual",
    "Couple",
    "Family",
    "Group",
    "Corporate",
    "Travel Agent",
    "Tour Operator",
    "Other",
]

EXPENSE_CATEGORIES = [
    "Accommodation",
    "Park Fees",
    "Fuel",
    "Flights",
    "Vehicle Costs",
    "Guide Costs",
    "Driver Costs",
    "Supplier Payments",
    "Transfers",
    "Marketing",
    "Office",
    "Staff",
    "Bank Charges",
    "Commission",
    "Other",
]

ROLE_PRESETS = {
    "Management": [
        "dashboard.view",
        "leads.view",
        "clients.view",
        "quotations.view",
        "bookings.view",
        "operations.view",
        "invoices.view",
        "payments.view",
        "expenses.view",
        "cashbook.view",
        "profitability.view",
        "reports.view",
        "vendors.view",
    ],
    "Sales Consultant": [
        "dashboard.view",
        "leads.manage",
        "clients.manage",
        "quotations.manage",
        "bookings.manage",
    ],
    "Operations": [
        "dashboard.view",
        "bookings.view",
        "bookings.edit",
        "operations.view",
        "vendors.view",
        "vendors.edit",
    ],
    "Finance": [
        "dashboard.view",
        "invoices.manage",
        "payments.manage",
        "expenses.manage",
        "costs.manage",
        "cashbook.view",
        "profitability.view",
        "reports.view",
    ],
    "Marketing": [
        "dashboard.view",
        "leads.view",
        "clients.view",
        "reports.view",
    ],
}


class Command(BaseCommand):
    help = "Seed catalog lists and optional preset roles from the PTSMS requirements brief."

    def add_arguments(self, parser):
        parser.add_argument("--roles", action="store_true", help="Create preset roles if missing")

    def handle(self, *args, **options):
        for code, label, module in PERMISSIONS:
            Permission.objects.update_or_create(code=code, defaults={"label": label, "module": module})

        for name in LEAD_SOURCES:
            LeadSource.objects.get_or_create(name=name)
        for name in CLIENT_TYPES:
            ClientType.objects.get_or_create(name=name)
        for name in EXPENSE_CATEGORIES:
            ExpenseCategory.objects.get_or_create(name=name)
        if not SafariType.objects.exists():
            SafariType.objects.create(name="Classic safari")
        if not Destination.objects.exists():
            Destination.objects.create(name="Northern circuit")
        if not PaymentMethod.objects.exists():
            for name in ["Bank Transfer", "Mobile Money", "Cash", "Card", "Online Payment", "Other"]:
                PaymentMethod.objects.get_or_create(name=name)

        self.stdout.write(self.style.SUCCESS("Catalog lists seeded."))

        if options["roles"]:
            for name, codes in ROLE_PRESETS.items():
                expanded = sorted(expand_codes(codes))
                role, created = Role.objects.get_or_create(
                    name=name,
                    defaults={"description": f"Preset role: {name}"},
                )
                if created or not role.permissions.exists():
                    perms = Permission.objects.filter(code__in=expanded)
                    role.permissions.set(perms)
                    self.stdout.write(f"Role {name}: {perms.count()} permissions")
            self.stdout.write(self.style.SUCCESS("Preset roles ready."))
