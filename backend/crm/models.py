from django.conf import settings
from django.db import models

from catalog.models import ClientType, Currency, Destination, LeadSource, SafariType


class Lead(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New inquiry"
        CONTACTED = "contacted", "In contact"
        QUALIFIED = "qualified", "Qualified"
        QUOTATION_SENT = "quotation_sent", "Quotation sent"
        FOLLOW_UP = "follow_up", "Follow-up needed"
        NEGOTIATION = "negotiation", "Negotiating"
        WON = "won", "Won — booking opened"
        LOST = "lost", "Lost"
        UNQUALIFIED = "unqualified", "Not a fit"

    class ContactChannel(models.TextChoices):
        EMAIL = "email", "Email"
        WHATSAPP = "whatsapp", "WhatsApp"
        PHONE = "phone", "Phone call"
        WEBSITE = "website", "Website / form"
        REFERRAL = "referral", "Referral"
        OTHER = "other", "Other"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"

    reference = models.CharField(max_length=20, unique=True, editable=False)
    full_name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    whatsapp = models.CharField(max_length=40, blank=True)
    contact_channel = models.CharField(max_length=20, choices=ContactChannel.choices, blank=True)
    country = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    travel_date = models.DateField(null=True, blank=True)
    adults = models.PositiveIntegerField(default=0)
    children = models.PositiveIntegerField(default=0)
    destinations = models.ManyToManyField(Destination, blank=True, related_name="leads")
    safari_type = models.ForeignKey(SafariType, null=True, blank=True, on_delete=models.SET_NULL)
    budget = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.ForeignKey(Currency, null=True, blank=True, on_delete=models.PROTECT)
    source = models.ForeignKey(LeadSource, null=True, blank=True, on_delete=models.SET_NULL)
    campaign = models.CharField(max_length=120, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="leads"
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.NEW)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.NORMAL)
    last_contact = models.DateField(null=True, blank=True)
    next_follow_up = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    converted_client = models.ForeignKey(
        "crm.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="source_leads"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="leads_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference} {self.full_name}"


class Client(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    reference = models.CharField(max_length=20, unique=True, editable=False)
    full_name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    whatsapp = models.CharField(max_length=40, blank=True)
    country = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    address = models.TextField(blank=True)
    client_type = models.ForeignKey(ClientType, null=True, blank=True, on_delete=models.SET_NULL)
    source = models.ForeignKey(LeadSource, null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="clients"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    next_follow_up = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="clients_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.reference} {self.full_name}"
