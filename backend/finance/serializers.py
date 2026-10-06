from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from bookings.models import Itinerary, Quotation
from catalog.models import Currency
from common.numbers import next_code
from bookings.services import stay_payment_status

from finance.models import ClientPayment, Expense, Invoice, VendorPayment
from finance.invoice_document import default_line_description, default_line_title
from finance.services import client_payment_summary, invoice_amounts, invoice_effective_status


class InvoiceSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    amount_paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    effective_status = serializers.SerializerMethodField()
    document = serializers.SerializerMethodField()
    consultant_name = serializers.CharField(source="booking.assigned_to.full_name", read_only=True)
    line_rate = serializers.SerializerMethodField()

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
            "line_title",
            "line_description",
            "quantity",
            "attention_to",
            "contact_person",
            "consultant_name",
            "line_rate",
            "document",
            "status",
            "effective_status",
            "amount_paid",
            "balance",
            "sent_at",
            "created_at",
        ]
        read_only_fields = [
            "number",
            "client",
            "currency",
            "total_amount",
            "status",
            "sent_at",
            "created_at",
            "document",
            "line_rate",
            "consultant_name",
            "effective_status",
            "amount_paid",
            "balance",
        ]

    def get_amount_paid(self, invoice):
        return invoice_amounts(invoice)["paid"]

    def get_balance(self, invoice):
        return invoice_amounts(invoice)["balance"]

    def get_effective_status(self, invoice):
        return invoice_effective_status(invoice)

    def get_line_rate(self, invoice):
        qty = invoice.quantity or 1
        return (invoice.total_amount / qty).quantize(Decimal("0.01"))

    def get_document(self, invoice):
        view = self.context.get("view")
        if view and getattr(view, "action", None) == "list":
            return None
        from finance.invoice_document import invoice_document

        return invoice_document(invoice, self.context.get("request"))

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
        booking = validated["booking"]
        validated.setdefault("quantity", max(booking.adults, 1))
        validated.setdefault("line_title", default_line_title(booking))
        validated.setdefault("line_description", default_line_description(booking))
        validated.setdefault("attention_to", booking.client.full_name)
        validated.setdefault("contact_person", booking.client.full_name)
        return super().create(validated)


class ClientPaymentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    invoice_number = serializers.CharField(source="invoice.number", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    amount_applied = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, write_only=False)
    currency = serializers.PrimaryKeyRelatedField(queryset=Currency.objects.all(), required=False)
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
        read_only_fields = ["booking", "client", "received_by", "created_at"]

    def validate(self, data):
        if self.instance and "invoice" in data and data["invoice"].id != self.instance.invoice_id:
            raise serializers.ValidationError({"invoice": "The invoice cannot be changed on an existing payment."})
        invoice = data.get("invoice") or getattr(self.instance, "invoice", None)
        if not self.instance and not invoice:
            raise serializers.ValidationError({"invoice": "Choose an invoice for this payment."})
        booking = data.get("booking") or getattr(self.instance, "booking", None)
        if invoice and booking and invoice.booking_id != booking.id:
            raise serializers.ValidationError("That invoice belongs to a different booking.")
        if invoice and invoice.status == Invoice.Status.CANCELLED:
            raise serializers.ValidationError("This invoice is cancelled.")
        if invoice and not data.get("currency"):
            data["currency"] = invoice.currency
        amount = data.get("amount")
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Enter a positive amount."})
        currency = data.get("currency") or getattr(self.instance, "currency", None)
        if invoice and currency and "amount_applied" not in data and not self.instance:
            if currency.id == invoice.currency_id:
                data["amount_applied"] = amount
            else:
                raise serializers.ValidationError(
                    {"amount_applied": "Enter how much of the safari fee this payment covers. The client paid in another currency."}
                )
        if invoice and amount is not None and "amount_applied" not in data:
            data["amount_applied"] = amount
        applied = data.get("amount_applied")
        if applied is not None and applied < 0:
            raise serializers.ValidationError({"amount_applied": "Applied amount cannot be negative."})
        if invoice and applied is not None:
            balance = invoice_amounts(invoice)["balance"]
            if self.instance:
                balance += self.instance.amount_applied or Decimal("0")
            if applied > balance:
                raise serializers.ValidationError({"amount": "This payment is more than the outstanding balance."})
        return data

    def update(self, instance, validated):
        validated.pop("invoice", None)
        if "amount" in validated and "amount_applied" not in validated:
            currency = validated.get("currency", instance.currency)
            if currency.id == instance.invoice.currency_id:
                validated["amount_applied"] = validated["amount"]
        return super().update(instance, validated)

    def create(self, validated):
        invoice = validated["invoice"]
        if invoice.status == Invoice.Status.DRAFT:
            invoice.status = Invoice.Status.SENT
            invoice.sent_at = timezone.now()
            invoice.save(update_fields=["status", "sent_at", "updated_at"])
        validated["booking"] = invoice.booking
        validated["client"] = invoice.client
        validated.setdefault("currency", invoice.currency)
        validated.setdefault("amount_applied", validated["amount"])
        validated["received_by"] = self.context["request"].user
        return super().create(validated)


class VendorPaymentSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="accommodation.vendor.name", read_only=True)
    property_name = serializers.CharField(source="accommodation.hotel.name", read_only=True)
    booking_reference = serializers.CharField(source="accommodation.booking.reference", read_only=True)
    booking = serializers.IntegerField(source="accommodation.booking_id", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    amount_applied = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    currency = serializers.PrimaryKeyRelatedField(queryset=Currency.objects.all(), required=False)
    method_name = serializers.CharField(source="payment_method.name", read_only=True)
    stay_payment_status = serializers.SerializerMethodField()

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
            "stay_payment_status",
            "reference",
            "notes",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_stay_payment_status(self, payment):
        return stay_payment_status(payment.accommodation)

    def validate(self, data):
        stay = data.get("accommodation") or getattr(self.instance, "accommodation", None)
        if stay and not data.get("currency"):
            if stay.cost_currency_id:
                data["currency"] = stay.cost_currency
            else:
                raise serializers.ValidationError({"currency": "Set the cost currency on the stay before paying the hotel."})
        amount = data.get("amount")
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Enter a positive amount."})
        currency = data.get("currency") or getattr(self.instance, "currency", None)
        if stay and currency and not self.instance and "amount_applied" not in data:
            if stay.cost_currency_id and currency.id == stay.cost_currency_id:
                data["amount_applied"] = amount
            elif not stay.cost_currency_id:
                data["amount_applied"] = amount
            else:
                raise serializers.ValidationError(
                    {"amount_applied": "Enter how much of the hotel cost this payment covers."}
                )
        if stay and amount is not None and "amount_applied" not in data:
            data["amount_applied"] = amount
        return data

    def create(self, validated):
        stay = validated["accommodation"]
        validated.setdefault("currency", stay.cost_currency)
        validated.setdefault("amount_applied", validated["amount"])
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
