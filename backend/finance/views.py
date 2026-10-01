from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasCode
from bookings.models import Booking, Quotation
from bookings.services import resolved_safari_status, vendor_payment_summary
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
from finance.services import booking_profit, cashbook, client_payment_summary, invoice_effective_status


def decimal_to_json(value):
    if isinstance(value, Decimal):
        return str(value)
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

    def get_queryset(self):
        return Invoice.objects.select_related("booking", "client", "currency").prefetch_related("payments")

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == Invoice.Status.CANCELLED:
            return Response({"detail": "This invoice is cancelled."}, status=400)
        invoice.status = Invoice.Status.SENT
        invoice.sent_at = timezone.now()
        invoice.save(update_fields=["status", "sent_at", "updated_at"])
        return Response(self.get_serializer(invoice).data)

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
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return ClientPayment.objects.select_related(
            "booking", "invoice", "client", "currency", "payment_method", "received_by"
        )


class VendorPaymentViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = VendorPaymentSerializer
    permission_classes = [HasCode]
    read_permission = "costs.view"
    write_permission = "costs.manage"
    filterset_fields = ["accommodation", "currency"]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return VendorPayment.objects.select_related(
            "accommodation__vendor", "accommodation__hotel", "accommodation__booking", "currency", "payment_method"
        )


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

    def get(self, request):
        rows = []
        bookings = Booking.objects.select_related("currency", "client").prefetch_related(
            "accommodations__cost_currency", "accommodations__vendor_payments", "expenses__currency"
        )
        for booking in bookings:
            profit = booking_profit(booking)
            rows.append(
                {
                    "id": booking.id,
                    "reference": booking.reference,
                    "client": booking.client.full_name,
                    "overall_status": booking.overall_status,
                    **profit,
                }
            )
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
                "upcoming_safaris": upcoming,
                "bookings": len(bookings),
                "open_invoices": open_invoices,
                "overdue_invoices": overdue,
                "payments_received": [{"currency": code, "amount": str(amount)} for code, amount in received.items()],
                "outstanding": [{"currency": code, "amount": str(amount)} for code, amount in outstanding.items()],
                "expenses": [{"currency": code, "amount": str(amount)} for code, amount in expenses.items()],
                "gross_profit": [{"currency": code, "amount": str(amount)} for code, amount in profit.items()],
                "cash_received": [
                    {"currency": row["currency__code"], "amount": str(row["total"] or 0)} for row in paid_cash
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
