import csv
import io
from datetime import datetime

from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone

from bookings.models import Accommodation, Activity, Booking, Itinerary, Quotation
from bookings.services import resolved_safari_status, vendor_payment_summary
from crm.models import Client, Lead
from finance.models import ClientPayment, Expense, Invoice, VendorPayment
from finance.services import booking_profit, cashbook, client_payment_summary, invoice_effective_status
from vendors.models import Vendor


def _user_sees_costs(user):
    return user.is_superadmin or user.has_code("costs.view")


def _date(value):
    return value.isoformat() if value else ""


def _choices_label(model, field, value):
    if not value:
        return ""
    return dict(model._meta.get_field(field).choices).get(value, value)


MODULE_CATALOG = [
    ("overview", "Overview", "Dashboard"),
    ("leads", "Leads", "CRM"),
    ("clients", "Clients", "CRM"),
    ("activities", "Activities", "CRM"),
    ("follow_ups", "Follow-ups", "CRM"),
    ("quotations", "Quotations", "Sales"),
    ("itineraries", "Itineraries", "Sales"),
    ("bookings", "Bookings", "Bookings"),
    ("operations", "Safari operations", "Operations"),
    ("vendors", "Vendors", "Operations"),
    ("stays", "Accommodations", "Operations"),
    ("invoices", "Invoices", "Finance"),
    ("client_payments", "Client payments", "Finance"),
    ("vendor_payments", "Vendor payments", "Finance"),
    ("expenses", "Expenses", "Finance"),
    ("cashbook", "Cashbook", "Finance"),
    ("profitability", "Profitability", "Finance"),
]


def module_index():
    counts = {
        "leads": Lead.objects.count(),
        "clients": Client.objects.count(),
        "activities": Activity.objects.count(),
        "follow_ups": Lead.objects.filter(next_follow_up__isnull=False).count()
        + Client.objects.filter(next_follow_up__isnull=False).count(),
        "quotations": Quotation.objects.count(),
        "itineraries": Itinerary.objects.count(),
        "bookings": Booking.objects.count(),
        "operations": Booking.objects.filter(
            overall_status__in=[Booking.Overall.ACTIVE, Booking.Overall.CONFIRMED]
        ).count(),
        "vendors": Vendor.objects.count(),
        "stays": Accommodation.objects.count(),
        "invoices": Invoice.objects.exclude(status=Invoice.Status.CANCELLED).count(),
        "client_payments": ClientPayment.objects.count(),
        "vendor_payments": VendorPayment.objects.count(),
        "expenses": Expense.objects.count(),
        "cashbook": ClientPayment.objects.count() + VendorPayment.objects.count() + Expense.objects.count(),
        "profitability": Booking.objects.count(),
    }
    groups: dict[str, list] = {}
    for module_id, title, group in MODULE_CATALOG:
        groups.setdefault(group, []).append(
            {
                "id": module_id,
                "title": title,
                "group": group,
                "count": counts.get(module_id, 0) if module_id != "overview" else None,
            }
        )
    return groups


def overview_payload():
    leads = Lead.objects.count()
    won = Lead.objects.filter(status=Lead.Status.WON).count()
    sources = (
        Lead.objects.values("source__name")
        .annotate(leads=Count("id"), won=Count("id", filter=Q(status=Lead.Status.WON)))
        .order_by("-leads")
    )
    staff = Lead.objects.values("assigned_to__full_name").annotate(leads=Count("id")).order_by("-leads")
    today = timezone.localdate()
    return {
        "leads": leads,
        "qualified_leads": Lead.objects.filter(
            status__in=[
                Lead.Status.QUALIFIED,
                Lead.Status.QUOTATION_SENT,
                Lead.Status.FOLLOW_UP,
                Lead.Status.NEGOTIATION,
                Lead.Status.WON,
            ]
        ).count(),
        "quotations": Quotation.objects.count(),
        "accepted_quotations": Quotation.objects.filter(status=Quotation.Status.ACCEPTED).count(),
        "bookings": Booking.objects.count(),
        "won_leads": won,
        "conversion_rate": round((won / leads) * 100, 1) if leads else 0,
        "upcoming": Booking.objects.filter(
            overall_status=Booking.Overall.CONFIRMED, start_date__gt=today
        ).count(),
        "in_progress": Booking.objects.filter(
            overall_status=Booking.Overall.CONFIRMED,
            start_date__lte=today,
            end_date__gte=today,
        ).count(),
        "completed": Booking.objects.filter(overall_status=Booking.Overall.COMPLETED).count(),
        "cancelled": Booking.objects.filter(overall_status=Booking.Overall.CANCELLED).count(),
        "sources": [
            {"source": row["source__name"] or "Not set", "leads": row["leads"], "won": row["won"]}
            for row in sources
        ],
        "staff": [{"name": row["assigned_to__full_name"] or "Unassigned", "leads": row["leads"]} for row in staff],
    }


def build_module_report(module_id: str, user):
    generated = timezone.localtime().isoformat()
    builders = {
        "overview": _overview_report,
        "leads": _leads_report,
        "clients": _clients_report,
        "activities": _activities_report,
        "follow_ups": _follow_ups_report,
        "quotations": _quotations_report,
        "itineraries": _itineraries_report,
        "bookings": _bookings_report,
        "operations": _operations_report,
        "vendors": _vendors_report,
        "stays": _stays_report,
        "invoices": _invoices_report,
        "client_payments": _client_payments_report,
        "vendor_payments": _vendor_payments_report,
        "expenses": _expenses_report,
        "cashbook": _cashbook_report,
        "profitability": _profitability_report,
    }
    builder = builders.get(module_id)
    if not builder:
        return None
    return builder(user, generated)


def _overview_report(user, generated):
    data = overview_payload()
    columns = [
        {"key": "metric", "label": "Metric"},
        {"key": "value", "label": "Value"},
    ]
    rows = [
        {"metric": "Leads", "value": data["leads"]},
        {"metric": "Qualified leads", "value": data["qualified_leads"]},
        {"metric": "Quotations", "value": data["quotations"]},
        {"metric": "Accepted quotations", "value": data["accepted_quotations"]},
        {"metric": "Bookings", "value": data["bookings"]},
        {"metric": "Won leads", "value": data["won_leads"]},
        {"metric": "Lead to won %", "value": data["conversion_rate"]},
        {"metric": "Upcoming safaris", "value": data["upcoming"]},
        {"metric": "Safaris in progress", "value": data["in_progress"]},
        {"metric": "Completed", "value": data["completed"]},
        {"metric": "Cancelled", "value": data["cancelled"]},
    ]
    return {
        "module": "overview",
        "title": "Overview",
        "group": "Dashboard",
        "generated_at": generated,
        "columns": columns,
        "rows": rows,
        "extra": data,
    }


def _leads_report(user, generated):
    columns = [
        {"key": "reference", "label": "Reference"},
        {"key": "full_name", "label": "Name"},
        {"key": "country", "label": "Country"},
        {"key": "status", "label": "Status"},
        {"key": "source", "label": "Source"},
        {"key": "assigned_to", "label": "Assigned to"},
        {"key": "travel_date", "label": "Travel date"},
        {"key": "budget", "label": "Budget"},
        {"key": "currency", "label": "Currency"},
        {"key": "next_follow_up", "label": "Next follow-up"},
    ]
    rows = []
    for lead in Lead.objects.select_related("source", "assigned_to", "currency").order_by("-created_at"):
        rows.append(
            {
                "reference": lead.reference,
                "full_name": lead.full_name,
                "country": lead.country,
                "status": _choices_label(Lead, "status", lead.status),
                "source": lead.source.name if lead.source else "",
                "assigned_to": lead.assigned_to.full_name if lead.assigned_to else "",
                "travel_date": _date(lead.travel_date),
                "budget": str(lead.budget or ""),
                "currency": lead.currency.code if lead.currency else "",
                "next_follow_up": _date(lead.next_follow_up),
            }
        )
    return _pack("leads", "Leads", "CRM", generated, columns, rows)


def _clients_report(user, generated):
    columns = [
        {"key": "reference", "label": "Reference"},
        {"key": "full_name", "label": "Name"},
        {"key": "country", "label": "Country"},
        {"key": "status", "label": "Status"},
        {"key": "email", "label": "Email"},
        {"key": "phone", "label": "Phone"},
        {"key": "assigned_to", "label": "Assigned to"},
    ]
    rows = []
    for client in Client.objects.select_related("assigned_to").order_by("full_name"):
        rows.append(
            {
                "reference": client.reference,
                "full_name": client.full_name,
                "country": client.country,
                "status": _choices_label(Client, "status", client.status),
                "email": client.email,
                "phone": client.phone,
                "assigned_to": client.assigned_to.full_name if client.assigned_to else "",
            }
        )
    return _pack("clients", "Clients", "CRM", generated, columns, rows)


def _activities_report(user, generated):
    columns = [
        {"key": "created_at", "label": "When"},
        {"key": "type", "label": "Type"},
        {"key": "body", "label": "Note"},
        {"key": "created_by", "label": "Staff"},
        {"key": "lead", "label": "Lead"},
        {"key": "client", "label": "Client"},
        {"key": "booking", "label": "Booking"},
    ]
    rows = []
    for row in Activity.objects.select_related("created_by", "lead", "client", "booking").order_by("-created_at"):
        rows.append(
            {
                "created_at": row.created_at.strftime("%Y-%m-%d %H:%M"),
                "type": row.get_activity_type_display(),
                "body": row.body,
                "created_by": row.created_by.full_name if row.created_by else "",
                "lead": row.lead.reference if row.lead else "",
                "client": row.client.reference if row.client else "",
                "booking": row.booking.reference if row.booking else "",
            }
        )
    return _pack("activities", "Activities", "CRM", generated, columns, rows)


def _follow_ups_report(user, generated):
    columns = [
        {"key": "kind", "label": "Kind"},
        {"key": "reference", "label": "Reference"},
        {"key": "name", "label": "Name"},
        {"key": "date", "label": "Follow-up date"},
        {"key": "state", "label": "Status"},
    ]
    rows = []
    leads = Lead.objects.exclude(next_follow_up=None).exclude(
        status__in=[Lead.Status.WON, Lead.Status.LOST, Lead.Status.UNQUALIFIED]
    )
    for lead in leads:
        rows.append(
            {
                "kind": "Lead",
                "reference": lead.reference,
                "name": lead.full_name,
                "date": _date(lead.next_follow_up),
                "state": _choices_label(Lead, "status", lead.status),
            }
        )
    for client in Client.objects.exclude(next_follow_up=None):
        rows.append(
            {
                "kind": "Client",
                "reference": client.reference,
                "name": client.full_name,
                "date": _date(client.next_follow_up),
                "state": _choices_label(Client, "status", client.status),
            }
        )
    rows.sort(key=lambda item: item["date"])
    return _pack("follow_ups", "Follow-ups", "CRM", generated, columns, rows)


def _quotations_report(user, generated):
    columns = [
        {"key": "number", "label": "Number"},
        {"key": "client", "label": "Client"},
        {"key": "booking", "label": "Booking"},
        {"key": "status", "label": "Status"},
        {"key": "total", "label": "Total"},
        {"key": "currency", "label": "Currency"},
        {"key": "validity", "label": "Valid until"},
    ]
    rows = []
    for q in Quotation.objects.select_related("booking", "client", "currency").order_by("-created_at"):
        rows.append(
            {
                "number": q.number,
                "client": q.client.full_name if q.client else "",
                "booking": q.booking.reference,
                "status": _choices_label(Quotation, "status", q.status),
                "total": str(q.total_amount),
                "currency": q.currency.code,
                "validity": _date(q.validity_date),
            }
        )
    return _pack("quotations", "Quotations", "Sales", generated, columns, rows)


def _itineraries_report(user, generated):
    columns = [
        {"key": "number", "label": "Number"},
        {"key": "client", "label": "Client"},
        {"key": "booking", "label": "Booking"},
        {"key": "start", "label": "Start"},
        {"key": "end", "label": "End"},
        {"key": "status", "label": "Status"},
        {"key": "total", "label": "Total"},
        {"key": "currency", "label": "Currency"},
    ]
    rows = []
    for it in Itinerary.objects.select_related("booking__client", "booking__currency").order_by("-created_at"):
        booking = it.booking
        rows.append(
            {
                "number": it.number,
                "client": booking.client.full_name,
                "booking": booking.reference,
                "start": _date(booking.start_date),
                "end": _date(booking.end_date),
                "status": _choices_label(Itinerary, "status", it.status),
                "total": str(booking.total_amount),
                "currency": booking.currency.code,
            }
        )
    return _pack("itineraries", "Itineraries", "Sales", generated, columns, rows)


def _bookings_report(user, generated):
    columns = [
        {"key": "reference", "label": "Reference"},
        {"key": "client", "label": "Client"},
        {"key": "dates", "label": "Dates"},
        {"key": "days", "label": "Days"},
        {"key": "fee", "label": "Fee"},
        {"key": "currency", "label": "Currency"},
        {"key": "overall", "label": "Overall status"},
        {"key": "safari", "label": "Safari status"},
        {"key": "client_paid", "label": "Client payment"},
        {"key": "vendor_paid", "label": "Vendor payment"},
    ]
    rows = []
    for booking in Booking.objects.select_related("client", "currency").prefetch_related(
        "payments", "accommodations__cost_currency", "accommodations__vendor_payments"
    ):
        safari = resolved_safari_status(booking)
        client_pay = client_payment_summary(booking)
        vendor_pay = vendor_payment_summary(booking)
        rows.append(
            {
                "reference": booking.reference,
                "client": booking.client.full_name,
                "dates": f"{booking.start_date} – {booking.end_date}",
                "days": booking.safari_days,
                "fee": str(booking.total_amount),
                "currency": booking.currency.code,
                "overall": _choices_label(Booking, "overall_status", booking.overall_status),
                "safari": dict(Booking.SafariStatus.choices).get(safari, safari),
                "client_paid": dict(Booking.PayStatus.choices).get(client_pay["status"], client_pay["status"]),
                "vendor_paid": dict(Booking.PayStatus.choices).get(vendor_pay["status"], vendor_pay["status"]),
            }
        )
    return _pack("bookings", "Bookings", "Bookings", generated, columns, rows)


def _operations_report(user, generated):
    columns = [
        {"key": "reference", "label": "Booking"},
        {"key": "client", "label": "Client"},
        {"key": "start", "label": "Start"},
        {"key": "end", "label": "End"},
        {"key": "safari", "label": "Safari status"},
        {"key": "overall", "label": "Overall"},
    ]
    rows = []
    qs = Booking.objects.filter(overall_status__in=[Booking.Overall.ACTIVE, Booking.Overall.CONFIRMED]).select_related(
        "client"
    )
    for booking in qs.order_by("start_date"):
        safari = resolved_safari_status(booking)
        rows.append(
            {
                "reference": booking.reference,
                "client": booking.client.full_name,
                "start": _date(booking.start_date),
                "end": _date(booking.end_date),
                "safari": dict(Booking.SafariStatus.choices).get(safari, safari),
                "overall": _choices_label(Booking, "overall_status", booking.overall_status),
            }
        )
    return _pack("operations", "Safari operations", "Operations", generated, columns, rows)


def _vendors_report(user, generated):
    columns = [
        {"key": "name", "label": "Vendor"},
        {"key": "type", "label": "Type"},
        {"key": "location", "label": "Location"},
        {"key": "phone", "label": "Phone"},
        {"key": "status", "label": "Status"},
        {"key": "properties", "label": "Properties"},
    ]
    rows = []
    for vendor in Vendor.objects.select_related("vendor_type").annotate(properties=Count("properties")).order_by("name"):
        rows.append(
            {
                "name": vendor.name,
                "type": vendor.vendor_type.name if vendor.vendor_type else "",
                "location": vendor.location,
                "phone": vendor.phone,
                "status": _choices_label(Vendor, "status", vendor.status),
                "properties": vendor.properties,
            }
        )
    return _pack("vendors", "Vendors", "Operations", generated, columns, rows)


def _stays_report(user, generated):
    columns = [
        {"key": "booking", "label": "Booking"},
        {"key": "vendor", "label": "Vendor"},
        {"key": "property", "label": "Property"},
        {"key": "check_in", "label": "Check in"},
        {"key": "check_out", "label": "Check out"},
        {"key": "nights", "label": "Nights"},
    ]
    if _user_sees_costs(user):
        columns.extend(
            [
                {"key": "agreed_cost", "label": "Agreed cost"},
                {"key": "cost_currency", "label": "Cost currency"},
            ]
        )
    rows = []
    for stay in Accommodation.objects.select_related("booking", "vendor", "hotel", "cost_currency").order_by("check_in"):
        row = {
            "booking": stay.booking.reference,
            "vendor": stay.vendor.name,
            "property": stay.hotel.name,
            "check_in": _date(stay.check_in),
            "check_out": _date(stay.check_out),
            "nights": stay.nights,
        }
        if _user_sees_costs(user):
            row["agreed_cost"] = str(stay.agreed_cost)
            row["cost_currency"] = stay.cost_currency.code if stay.cost_currency else ""
        rows.append(row)
    return _pack("stays", "Accommodations", "Operations", generated, columns, rows)


def _invoices_report(user, generated):
    columns = [
        {"key": "number", "label": "Invoice"},
        {"key": "client", "label": "Client"},
        {"key": "booking", "label": "Booking"},
        {"key": "date", "label": "Date"},
        {"key": "due", "label": "Due"},
        {"key": "total", "label": "Total"},
        {"key": "currency", "label": "Currency"},
        {"key": "status", "label": "Status"},
    ]
    rows = []
    for invoice in Invoice.objects.select_related("client", "booking", "currency").prefetch_related("payments"):
        rows.append(
            {
                "number": invoice.number,
                "client": invoice.client.full_name,
                "booking": invoice.booking.reference,
                "date": _date(invoice.invoice_date),
                "due": _date(invoice.due_date),
                "total": str(invoice.total_amount),
                "currency": invoice.currency.code,
                "status": invoice_effective_status(invoice),
            }
        )
    return _pack("invoices", "Invoices", "Finance", generated, columns, rows)


def _client_payments_report(user, generated):
    columns = [
        {"key": "date", "label": "Date"},
        {"key": "client", "label": "Client"},
        {"key": "booking", "label": "Booking"},
        {"key": "amount", "label": "Received"},
        {"key": "currency", "label": "Currency"},
        {"key": "applied", "label": "Applied to fee"},
        {"key": "method", "label": "Method"},
    ]
    rows = []
    for payment in ClientPayment.objects.select_related("client", "booking", "currency", "payment_method").order_by(
        "-paid_on"
    ):
        rows.append(
            {
                "date": _date(payment.paid_on),
                "client": payment.client.full_name if payment.client else "",
                "booking": payment.booking.reference if payment.booking else "",
                "amount": str(payment.amount),
                "currency": payment.currency.code,
                "applied": str(payment.amount_applied),
                "method": payment.payment_method.name if payment.payment_method else "",
            }
        )
    return _pack("client_payments", "Client payments", "Finance", generated, columns, rows)


def _vendor_payments_report(user, generated):
    columns = [
        {"key": "date", "label": "Date"},
        {"key": "vendor", "label": "Vendor"},
        {"key": "booking", "label": "Booking"},
        {"key": "property", "label": "Property"},
        {"key": "amount", "label": "Paid"},
        {"key": "currency", "label": "Currency"},
        {"key": "applied", "label": "Applied"},
    ]
    rows = []
    for payment in VendorPayment.objects.select_related(
        "accommodation__vendor", "accommodation__booking", "accommodation__hotel", "currency"
    ).order_by("-paid_on"):
        rows.append(
            {
                "date": _date(payment.paid_on),
                "vendor": payment.accommodation.vendor.name if payment.accommodation_id else "",
                "booking": payment.accommodation.booking.reference if payment.accommodation_id else "",
                "property": payment.accommodation.hotel.name if payment.accommodation_id else "",
                "amount": str(payment.amount),
                "currency": payment.currency.code,
                "applied": str(payment.amount_applied),
            }
        )
    return _pack("vendor_payments", "Vendor payments", "Finance", generated, columns, rows)


def _expenses_report(user, generated):
    columns = [
        {"key": "date", "label": "Date"},
        {"key": "category", "label": "Category"},
        {"key": "booking", "label": "Booking"},
        {"key": "description", "label": "Description"},
        {"key": "amount", "label": "Amount"},
        {"key": "currency", "label": "Currency"},
    ]
    rows = []
    for expense in Expense.objects.select_related("category", "booking", "currency").order_by("-spent_on"):
        rows.append(
            {
                "date": _date(expense.spent_on),
                "category": expense.category.name if expense.category else "",
                "booking": expense.booking.reference if expense.booking else "",
                "description": expense.description,
                "amount": str(expense.amount),
                "currency": expense.currency.code,
            }
        )
    return _pack("expenses", "Expenses", "Finance", generated, columns, rows)


def _cashbook_report(user, generated):
    columns = [
        {"key": "date", "label": "Date"},
        {"key": "direction", "label": "In / out"},
        {"key": "kind", "label": "Type"},
        {"key": "reference", "label": "Reference"},
        {"key": "party", "label": "Party"},
        {"key": "amount", "label": "Amount"},
        {"key": "currency", "label": "Currency"},
        {"key": "method", "label": "Method"},
        {"key": "balance", "label": "Balance after"},
    ]
    rows = []
    payload = cashbook()
    for entries in payload["books"].values():
        for entry in entries:
            money_in = entry["money_in"] or 0
            money_out = entry["money_out"] or 0
            rows.append(
                {
                    "date": _date(entry["date"]),
                    "direction": "In" if money_in > 0 else "Out",
                    "kind": entry["category"],
                    "reference": entry.get("reference", ""),
                    "party": entry.get("description", ""),
                    "amount": str(money_in if money_in > 0 else money_out),
                    "currency": entry["currency"],
                    "method": entry.get("method", ""),
                    "balance": str(entry["balance"]),
                }
            )
    return _pack("cashbook", "Cashbook", "Finance", generated, columns, rows)


def _profitability_report(user, generated):
    columns = [
        {"key": "booking", "label": "Booking"},
        {"key": "client", "label": "Client"},
        {"key": "fee", "label": "Fee"},
        {"key": "currency", "label": "Currency"},
    ]
    if _user_sees_costs(user):
        columns.append({"key": "gross_profit", "label": "Gross profit"})
    rows = []
    for booking in Booking.objects.select_related("client", "currency").prefetch_related("accommodations", "expenses"):
        profit = booking_profit(booking)
        row = {
            "booking": booking.reference,
            "client": booking.client.full_name,
            "fee": str(booking.total_amount),
            "currency": booking.currency.code,
        }
        if _user_sees_costs(user):
            row["gross_profit"] = str(profit["gross_profit"]["amount"])
        rows.append(row)
    return _pack("profitability", "Profitability", "Finance", generated, columns, rows)


def _pack(module, title, group, generated, columns, rows):
    return {
        "module": module,
        "title": title,
        "group": group,
        "generated_at": generated,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def csv_response(report: dict) -> HttpResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([col["label"] for col in report["columns"]])
    for row in report["rows"]:
        writer.writerow([row.get(col["key"], "") for col in report["columns"]])
    response = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
    stamp = datetime.now().strftime("%Y%m%d")
    response["Content-Disposition"] = f'attachment; filename="ptsms-{report["module"]}-{stamp}.csv"'
    return response
