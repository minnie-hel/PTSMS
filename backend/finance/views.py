from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasAnyCode, HasCode
from bookings.models import Accommodation, Booking, Quotation
from bookings.services import resolved_safari_status, stay_paid, stay_payment_status, vendor_payment_summary
from common.mixins import AuditMixin, ProtectedDestroyMixin
from crm.models import Client, Lead
from finance.models import ClientPayment, Expense, Invoice, VendorPayment
from finance.serializers import (
    ClientPaymentSerializer,
    ExpenseSerializer,
    InvoiceSerializer,
    VendorPaymentSerializer,
)
from finance.notifications import desk_notifications
from finance.services import (
    booking_profit,
    cashbook,
    client_payment_summary,
    invoice_amounts,
    invoice_effective_status,
    profitability_detail,
    profitability_summary,
)


def money_amount_str(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def decimal_to_json(value):
    if isinstance(value, Decimal):
        return money_amount_str(value)
    if isinstance(value, dict):
        return {key: decimal_to_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [decimal_to_json(item) for item in value]
    return value


class InvoiceViewSet(AuditMixin, ProtectedDestroyMixin, viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [HasCode]
    read_permission = "invoices.view"
    write_permission = "invoices.manage"
    search_fields = ["number", "client__full_name", "booking__reference"]
    filterset_fields = ["status", "booking", "client"]

    def get_permissions(self):
        if self.action == "list" and self.request.query_params.get("for_payment") == "1":
            self.any_permissions = ["invoices.view", "payments.view"]
            return [HasAnyCode()]
        return super().get_permissions()

    def get_queryset(self):
        return Invoice.objects.select_related(
            "booking", "booking__assigned_to", "client", "currency"
        ).prefetch_related("payments", "booking__destinations", "booking__accommodations__hotel", "booking__accommodations__vendor")

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == Invoice.Status.CANCELLED:
            return Response({"detail": "This invoice is cancelled."}, status=400)
        invoice.status = Invoice.Status.SENT
        invoice.sent_at = timezone.now()
        invoice.save(update_fields=["status", "sent_at", "updated_at"])
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=["get"])
    def export(self, request, pk=None):
        from finance.invoice_document import invoice_document
        from finance.reports import csv_response

        invoice = self.get_object()
        doc = invoice_document(invoice, request)
        format_name = (request.query_params.get("format") or "csv").lower()
        if format_name == "csv":
            rows = [
                {"Field": "Invoice", "Value": doc["number"]},
                {"Field": "Client", "Value": doc["client_name"]},
                {"Field": "Total", "Value": doc["total_display"]},
                {"Field": "Paid", "Value": doc["amount_paid_display"]},
                {"Field": "Balance", "Value": doc["balance_display"]},
            ]
            return csv_response({"title": f"Invoice {doc['number']}", "columns": ["Field", "Value"], "rows": rows})
        if format_name == "json":
            return Response(doc)
        return Response({"detail": "Use format=csv or format=json. PDF and Excel are generated in the browser."}, status=400)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        if invoice.payments.exists():
            return Response({"detail": "An invoice with payments cannot be cancelled."}, status=400)
        invoice.status = Invoice.Status.CANCELLED
        invoice.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(invoice).data)


class ClientPaymentViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = ClientPaymentSerializer
    permission_classes = [HasCode]
    read_permission = "payments.view"
    write_permission = "payments.manage"
    filterset_fields = ["booking", "invoice", "client", "currency"]
    search_fields = ["reference", "client__full_name", "booking__reference"]
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        return ClientPayment.objects.select_related(
            "booking", "invoice", "client", "currency", "payment_method", "received_by"
        )

    @action(detail=False, methods=["get"], url_path="invoice-options")
    def invoice_options(self, request):
        """Invoices that can receive a client payment (for the record-payment form)."""
        rows = []
        invoices = (
            Invoice.objects.exclude(status=Invoice.Status.CANCELLED)
            .select_related("client", "currency", "booking")
            .order_by("-invoice_date", "-id")
        )
        for invoice in invoices:
            amounts = invoice_amounts(invoice)
            if amounts["balance"] <= 0:
                continue
            pay = client_payment_summary(invoice.booking)
            rows.append(
                {
                    "id": invoice.id,
                    "number": invoice.number,
                    "client_name": invoice.client.full_name,
                    "booking_reference": invoice.booking.reference,
                    "balance": str(amounts["balance"]),
                    "total_amount": str(invoice.total_amount),
                    "currency_code": invoice.currency.code,
                    "status": invoice.status,
                    "client_payment_status": pay["status"],
                }
            )
        return Response(rows)


class VendorPaymentViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = VendorPaymentSerializer
    permission_classes = [HasCode]
    read_permission = "costs.view"
    write_permission = "costs.manage"
    filterset_fields = ["accommodation", "currency"]
    search_fields = ["reference", "accommodation__booking__reference", "accommodation__vendor__name", "accommodation__hotel__name"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return VendorPayment.objects.select_related(
            "accommodation__vendor", "accommodation__hotel", "accommodation__booking", "currency", "payment_method"
        )

    @action(detail=False, methods=["get"], url_path="stay-options")
    def stay_options(self, request):
        """Stays on bookings that can receive a hotel (vendor) payment."""
        vendor_id = request.query_params.get("vendor")
        stays = Accommodation.objects.select_related("booking", "vendor", "hotel", "cost_currency").prefetch_related(
            "vendor_payments"
        )
        if vendor_id:
            stays = stays.filter(vendor_id=vendor_id)
        rows = []
        for stay in stays.order_by("-check_in", "-id"):
            owed = (stay.agreed_cost or Decimal("0")) - stay_paid(stay)
            rows.append(
                {
                    "id": stay.id,
                    "vendor": stay.vendor_id,
                    "vendor_name": stay.vendor.name,
                    "property_name": stay.hotel.name,
                    "booking_reference": stay.booking.reference,
                    "check_in": stay.check_in.isoformat(),
                    "check_out": stay.check_out.isoformat(),
                    "agreed_cost": str(stay.agreed_cost or 0),
                    "amount_owed": str(owed if owed > Decimal("0") else Decimal("0")),
                    "cost_currency_id": stay.cost_currency_id,
                    "cost_currency_code": stay.cost_currency.code if stay.cost_currency_id else "",
                    "vendor_payment_status": stay_payment_status(stay),
                    "bank_account_name": stay.vendor.bank_account_name,
                    "bank_account_number": stay.vendor.bank_account_number,
                    "bank_name": stay.vendor.bank_name,
                    "bank_branch": stay.vendor.bank_branch,
                    "bank_swift": stay.vendor.bank_swift,
                    "bank_iban": stay.vendor.bank_iban,
                }
            )
        return Response(rows)


class ExpenseViewSet(AuditMixin, ProtectedDestroyMixin, viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [HasCode]
    read_permission = "expenses.view"
    write_permission = "expenses.manage"
    filterset_fields = ["booking", "category", "vendor", "currency"]
    search_fields = ["description", "reference", "booking__reference"]

    def get_queryset(self):
        return Expense.objects.select_related(
            "category", "vendor", "booking", "currency", "payment_method", "recorded_by"
        )


class CashbookView(APIView):
    permission_classes = [HasCode]
    read_permission = "cashbook.view"

    def get(self, request):
        payload = cashbook(
            currency_code=request.query_params.get("currency") or None,
            method_id=request.query_params.get("method") or None,
        )
        return Response(decimal_to_json(payload))


class ProfitabilityView(APIView):
    permission_classes = [HasCode]
    read_permission = "profitability.view"

    def get(self, request, booking_id=None):
        if booking_id is not None:
            booking = get_object_or_404(
                Booking.objects.select_related("currency", "client").prefetch_related(
                    "accommodations__cost_currency",
                    "accommodations__hotel",
                    "expenses__currency",
                    "expenses__category",
                ),
                pk=booking_id,
            )
            return Response(decimal_to_json(profitability_detail(booking)))
        rows = []
        bookings = Booking.objects.select_related("currency", "client").prefetch_related(
            "accommodations__cost_currency", "expenses__currency"
        )
        for booking in bookings.order_by("-start_date", "-id"):
            rows.append(profitability_summary(booking))
        return Response(decimal_to_json(rows))


class NotificationView(APIView):
    permission_classes = [HasCode]
    read_permission = "dashboard.view"

    def get(self, request):
        return Response({"items": desk_notifications()})


class DashboardView(APIView):
    permission_classes = [HasCode]
    read_permission = "dashboard.view"

    def get(self, request):
        today = timezone.localdate()
        bookings = list(
            Booking.objects.select_related("currency", "client").prefetch_related(
                "payments",
                "accommodations__cost_currency",
                "accommodations__vendor_payments",
                "expenses__currency",
                "invoices",
            )
        )
        received = defaultdict(Decimal)
        outstanding = defaultdict(Decimal)
        expenses = defaultdict(Decimal)
        profit = defaultdict(Decimal)
        upcoming = 0
        confirmed = 0
        for booking in bookings:
            summary = client_payment_summary(booking)
            received[booking.currency.code] += summary["paid"]
            outstanding[booking.currency.code] += summary["balance"]
            if booking.overall_status == Booking.Overall.CONFIRMED:
                confirmed += 1
                if resolved_safari_status(booking) == Booking.SafariStatus.WAITING_FOR_SAFARI:
                    upcoming += 1
            result = booking_profit(booking)
            profit[result["gross_profit"]["currency"]] += result["gross_profit"]["amount"]
            for bucket in result["hotel_costs"]:
                expenses[bucket["currency"]] += bucket["amount"]
            for bucket in result["other_expenses"]:
                expenses[bucket["currency"]] += bucket["amount"]
        paid_cash = ClientPayment.objects.values("currency__code").annotate(total=Sum("amount"))
        open_invoices = 0
        overdue = 0
        for invoice in Invoice.objects.exclude(status=Invoice.Status.CANCELLED).prefetch_related("payments"):
            status = invoice_effective_status(invoice)
            if status in ("sent", "partially_paid", "overdue"):
                open_invoices += 1
            if status == "overdue":
                overdue += 1
        return Response(
            {
                "leads": Lead.objects.count(),
                "active_clients": Client.objects.filter(status=Client.Status.ACTIVE).count(),
                "quotations": Quotation.objects.exclude(status=Quotation.Status.DECLINED).count(),
                "confirmed_bookings": confirmed,
                "completed_bookings": Booking.objects.filter(overall_status=Booking.Overall.COMPLETED).count(),
                "upcoming_safaris": upcoming,
                "bookings": len(bookings),
                "open_invoices": open_invoices,
                "overdue_invoices": overdue,
                "payments_received": [{"currency": code, "amount": money_amount_str(amount)} for code, amount in received.items()],
                "outstanding": [{"currency": code, "amount": money_amount_str(amount)} for code, amount in outstanding.items()],
                "expenses": [{"currency": code, "amount": money_amount_str(amount)} for code, amount in expenses.items()],
                "gross_profit": [{"currency": code, "amount": money_amount_str(amount)} for code, amount in profit.items()],
                "cash_received": [
                    {"currency": row["currency__code"], "amount": money_amount_str(row["total"] or Decimal("0"))}
                    for row in paid_cash
                ],
                "follow_ups_due": Lead.objects.filter(next_follow_up__lte=today)
                .exclude(status__in=[Lead.Status.WON, Lead.Status.LOST, Lead.Status.UNQUALIFIED])
                .count(),
            }
        )


class ReportView(APIView):
    permission_classes = [HasCode]
    read_permission = "reports.view"

    def get(self, request):
        from finance.reports import build_module_report, csv_response, module_index, overview_payload

        module = request.query_params.get("module")
        if request.query_params.get("format") == "csv":
            if not module:
                return Response({"detail": "Choose a module to export."}, status=400)
            report = build_module_report(module, request.user)
            if not report:
                return Response({"detail": "Unknown report module."}, status=404)
            return csv_response(report)

        if module:
            report = build_module_report(module, request.user)
            if not report:
                return Response({"detail": "Unknown report module."}, status=404)
            return Response(report)

        return Response(
            {
                "groups": module_index(),
                "overview": overview_payload(),
            }
        )
