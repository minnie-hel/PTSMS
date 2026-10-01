from django.utils import timezone

from bookings.models import Booking, Quotation
from crm.models import Client, Lead
from finance.models import Invoice
from finance.services import invoice_effective_status


def desk_notifications():
    today = timezone.localdate()
    items = []
    due = Lead.objects.filter(next_follow_up__lte=today).exclude(
        status__in=[Lead.Status.WON, Lead.Status.LOST, Lead.Status.UNQUALIFIED]
    ).count()
    if due:
        items.append({"kind": "follow_up", "label": f"{due} lead follow-up(s) due", "path": "/follow-ups"})
    client_due = Client.objects.filter(next_follow_up__lte=today).count()
    if client_due:
        items.append(
            {"kind": "follow_up", "label": f"{client_due} client follow-up(s) due", "path": "/follow-ups"}
        )
    overdue = 0
    for invoice in Invoice.objects.exclude(status=Invoice.Status.CANCELLED).prefetch_related("payments"):
        if invoice_effective_status(invoice) == "overdue":
            overdue += 1
    if overdue:
        items.append({"kind": "invoice", "label": f"{overdue} overdue invoice(s)", "path": "/invoices"})
    upcoming = Booking.objects.filter(
        overall_status=Booking.Overall.CONFIRMED, start_date__lte=today, end_date__gte=today
    ).count()
    if upcoming:
        items.append({"kind": "safari", "label": f"{upcoming} safari(s) in progress", "path": "/operations"})
    sent = Quotation.objects.filter(status=Quotation.Status.SENT).count()
    if sent:
        items.append({"kind": "quotation", "label": f"{sent} quotation(s) awaiting reply", "path": "/pipeline"})
    return items
