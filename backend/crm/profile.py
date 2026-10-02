from collections import defaultdict
from decimal import Decimal

from bookings.models import Activity, Booking, Quotation
from finance.models import ClientPayment, Invoice
from finance.services import invoice_amounts, invoice_effective_status


def _money_rows(pairs):
    return [{"currency": code, "amount": str(amount)} for code, amount in sorted(pairs.items()) if amount]


def build_client_profile(client, user):
    bookings = Booking.objects.filter(client=client).order_by("-booking_date")
    quotation_qs = Quotation.objects.filter(client=client).select_related("currency", "booking")
    quotations = list(quotation_qs.order_by("-created_at")[:50])
    invoice_qs = (
        Invoice.objects.filter(client=client)
        .exclude(status=Invoice.Status.CANCELLED)
        .select_related("currency", "booking")
    )
    invoice_list = list(invoice_qs.order_by("-invoice_date")[:50])
    payments = (
        ClientPayment.objects.filter(client=client)
        .select_related("currency", "booking", "invoice")
        .order_by("-paid_on")[:50]
    )
    activities = (
        Activity.objects.filter(client=client)
        .select_related("created_by")
        .order_by("-created_at")[:50]
    )
    leads = list(client.source_leads.all().order_by("-created_at")[:20])

    invoiced = defaultdict(Decimal)
    paid = defaultdict(Decimal)
    outstanding = defaultdict(Decimal)
    for invoice in invoice_qs:
        code = invoice.currency.code
        invoiced[code] += invoice.total_amount or Decimal("0")
        amounts = invoice_amounts(invoice)
        paid[code] += amounts["paid"]
        outstanding[code] += amounts["balance"]

    confirmed = bookings.filter(overall_status__in=[Booking.Overall.CONFIRMED, Booking.Overall.COMPLETED]).count()

    profile = {
        "quotation_count": quotation_qs.count(),
        "booking_count": bookings.count(),
        "confirmed_bookings": confirmed,
        "total_invoiced": _money_rows(invoiced),
        "total_paid": _money_rows(paid),
        "outstanding": _money_rows(outstanding),
        "quotations": [
            {
                "id": q.id,
                "number": q.number,
                "status": q.status,
                "total_amount": str(q.total_amount),
                "currency_code": q.currency.code,
                "booking_reference": q.booking.reference,
            }
            for q in quotations
        ],
        "bookings": [
            {
                "id": b.id,
                "reference": b.reference,
                "start_date": str(b.start_date),
                "overall_status": b.overall_status,
                "total_amount": str(b.total_amount),
                "currency_code": b.currency.code,
            }
            for b in bookings[:50]
        ],
        "source_leads": [{"id": lead.id, "reference": lead.reference, "full_name": lead.full_name} for lead in leads],
        "activities": [
            {
                "id": a.id,
                "type_label": a.get_activity_type_display(),
                "body": a.body,
                "created_by_name": a.created_by.full_name if a.created_by_id else "",
                "created_at": a.created_at.isoformat(),
            }
            for a in activities
        ],
    }

    if user.has_code("invoices.view"):
        profile["invoices"] = [
            {
                "id": inv.id,
                "number": inv.number,
                "booking_reference": inv.booking.reference,
                "total_amount": str(inv.total_amount),
                "balance": str(invoice_amounts(inv)["balance"]),
                "currency_code": inv.currency.code,
                "effective_status": invoice_effective_status(inv),
            }
            for inv in invoice_list
        ]
    else:
        profile["invoices"] = []

    if user.has_code("payments.view"):
        profile["payments"] = [
            {
                "id": p.id,
                "paid_on": str(p.paid_on),
                "amount": str(p.amount),
                "currency_code": p.currency.code,
                "booking_reference": p.booking.reference,
                "invoice_number": p.invoice.number,
            }
            for p in payments
        ]
    else:
        profile["payments"] = []

    return profile
