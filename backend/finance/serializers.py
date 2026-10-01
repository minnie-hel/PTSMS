from django.utils import timezone
from rest_framework import serializers

from bookings.models import Itinerary, Quotation
from common.numbers import next_code
from finance.models import ClientPayment, Expense, Invoice, VendorPayment
from finance.services import invoice_amounts, invoice_effective_status


class InvoiceSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    amount_paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    effective_status = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id",
            "number",
            "booking",
            "booking_reference",
            "client",
            "client_name",
            "invoice_date",
            "due_date",
            "currency",
            "currency_code",
            "total_amount",
            "payment_terms",
            "notes",
            "status",
            "effective_status",
            "amount_paid",
            "balance",
            "sent_at",
            "created_at",
        ]
        read_only_fields = ["number", "client", "currency", "total_amount", "status", "sent_at", "created_at"]

    def get_amount_paid(self, invoice):
        return invoice_amounts(invoice)["paid"]

    def get_balance(self, invoice):
        return invoice_amounts(invoice)["balance"]

    def get_effective_status(self, invoice):
        return invoice_effective_status(invoice)

    def create(self, validated):
        booking = validated["booking"]
        if not Itinerary.objects.filter(booking=booking).exists():
            raise serializers.ValidationError("Create the itinerary before the invoice.")
        if not booking.quotations.filter(status=Quotation.Status.ACCEPTED).exists():
            raise serializers.ValidationError("Accept the quotation before the invoice.")
        if booking.invoices.exclude(status=Invoice.Status.CANCELLED).exists():
            raise serializers.ValidationError("This booking already has an invoice.")
        validated["client"] = booking.client
        validated["currency"] = booking.currency
        validated["total_amount"] = booking.total_amount
        validated["number"] = next_code(Invoice, "number", "INV", validated.get("invoice_date"))
        validated["created_by"] = self.context["request"].user
        return super().create(validated)


class ClientPaymentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    invoice_number = serializers.CharField(source="invoice.number", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    amount_applied = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    method_name = serializers.CharField(source="payment_method.name", read_only=True)
    received_by_name = serializers.CharField(source="received_by.full_name", read_only=True)

    class Meta:
        model = ClientPayment
        fields = [
            "id",
            "booking",
            "booking_reference",
            "invoice",
            "invoice_number",
            "client",
            "client_name",
            "paid_on",
            "amount",
            "currency",
            "currency_code",
            "amount_applied",
            "payment_method",
            "method_name",
            "reference",
            "notes",
            "received_by",
            "received_by_name",
            "created_at",
        ]
        read_only_fields = ["client", "received_by", "created_at"]

    def validate(self, data):
        invoice = data.get("invoice") or getattr(self.instance, "invoice", None)
        booking = data.get("booking") or getattr(self.instance, "booking", None)
        if invoice and booking and invoice.booking_id != booking.id:
            raise serializers.ValidationError("That invoice belongs to a different booking.")
        if invoice and invoice.status == Invoice.Status.DRAFT:
            raise serializers.ValidationError("Send the invoice before recording a payment.")
        if invoice and invoice.status == Invoice.Status.CANCELLED:
            raise serializers.ValidationError("This invoice is cancelled.")
        currency = data.get("currency") or getattr(self.instance, "currency", None)
        if invoice and currency and "amount_applied" not in data and not self.instance:
            if currency.id == invoice.currency_id:
                data["amount_applied"] = data.get("amount")
            else:
                raise serializers.ValidationError(
                    {"amount_applied": "Enter how much of the safari fee this payment covers. The client paid in another currency."}
                )
        if data.get("amount_applied") is not None and data["amount_applied"] < 0:
            raise serializers.ValidationError({"amount_applied": "Applied amount cannot be negative."})
        return data

    def create(self, validated):
        invoice = validated["invoice"]
        validated["booking"] = invoice.booking
        validated["client"] = invoice.client
        if "amount_applied" not in validated:
            validated["amount_applied"] = validated["amount"]
        validated["received_by"] = self.context["request"].user
        return super().create(validated)


class VendorPaymentSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="accommodation.vendor.name", read_only=True)
    property_name = serializers.CharField(source="accommodation.hotel.name", read_only=True)
    booking_reference = serializers.CharField(source="accommodation.booking.reference", read_only=True)
    booking = serializers.IntegerField(source="accommodation.booking_id", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    amount_applied = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    method_name = serializers.CharField(source="payment_method.name", read_only=True)

    class Meta:
        model = VendorPayment
        fields = [
            "id",
            "accommodation",
            "vendor_name",
            "property_name",
            "booking",
            "booking_reference",
            "paid_on",
            "amount",
            "currency",
            "currency_code",
            "amount_applied",
            "payment_method",
            "method_name",
            "reference",
            "notes",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, data):
        stay = data.get("accommodation") or getattr(self.instance, "accommodation", None)
        currency = data.get("currency") or getattr(self.instance, "currency", None)
        if stay and currency and not self.instance and "amount_applied" not in data:
            if stay.cost_currency_id and currency.id == stay.cost_currency_id:
                data["amount_applied"] = data.get("amount")
            elif not stay.cost_currency_id:
                data["amount_applied"] = data.get("amount")
            else:
                raise serializers.ValidationError(
                    {"amount_applied": "Enter how much of the hotel cost this payment covers."}
                )
        return data

    def create(self, validated):
        if "amount_applied" not in validated:
            validated["amount_applied"] = validated["amount"]
        validated["recorded_by"] = self.context["request"].user
        return super().create(validated)


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    method_name = serializers.CharField(source="payment_method.name", read_only=True)
    recorded_by_name = serializers.CharField(source="recorded_by.full_name", read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "spent_on",
            "category",
            "category_name",
            "vendor",
            "vendor_name",
            "booking",
            "booking_reference",
            "amount",
            "currency",
            "currency_code",
            "payment_method",
            "method_name",
            "reference",
            "description",
            "recorded_by",
            "recorded_by_name",
            "created_at",
        ]
        read_only_fields = ["recorded_by", "created_at"]

    def create(self, validated):
        validated["recorded_by"] = self.context["request"].user
        return super().create(validated)


class InvoiceSendSerializer(serializers.Serializer):
    def save(self, invoice):
        invoice.status = Invoice.Status.SENT
        invoice.sent_at = timezone.now()
        invoice.save(update_fields=["status", "sent_at", "updated_at"])
        return invoice
