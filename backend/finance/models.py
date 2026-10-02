from django.conf import settings
from django.db import models

from bookings.models import Accommodation, Booking
from catalog.models import Currency, ExpenseCategory, PaymentMethod
from crm.models import Client
from vendors.models import Vendor


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=20, unique=True, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.PROTECT, related_name="invoices")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="invoices")
    invoice_date = models.DateField()
    due_date = models.DateField()
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_terms = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    line_title = models.CharField(max_length=300, blank=True)
    line_description = models.TextField(blank=True)
    quantity = models.PositiveIntegerField(default=1)
    attention_to = models.CharField(max_length=200, blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices_created"
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-invoice_date", "-id"]

    def __str__(self):
        return self.number


class ClientPayment(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.PROTECT, related_name="payments")
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="payments")
    paid_on = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, related_name="client_payments")
    amount_applied = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.ForeignKey(PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL)
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments_received"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_on", "-id"]

    def __str__(self):
        return f"{self.currency.code} {self.amount} for {self.booking.reference}"


class VendorPayment(models.Model):
    accommodation = models.ForeignKey(Accommodation, on_delete=models.PROTECT, related_name="vendor_payments")
    paid_on = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, related_name="vendor_payments")
    amount_applied = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.ForeignKey(
        PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL, related_name="vendor_payments"
    )
    reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="vendor_payments"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_on", "-id"]

    def __str__(self):
        return f"Vendor payment {self.amount}"


class Expense(models.Model):
    spent_on = models.DateField()
    category = models.ForeignKey(ExpenseCategory, null=True, blank=True, on_delete=models.SET_NULL)
    vendor = models.ForeignKey(Vendor, null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses")
    booking = models.ForeignKey(Booking, null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, related_name="expenses")
    payment_method = models.ForeignKey(
        PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses"
    )
    reference = models.CharField(max_length=80, blank=True)
    description = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses_recorded"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-spent_on", "-id"]

    def __str__(self):
        return self.description or f"Expense {self.amount}"
