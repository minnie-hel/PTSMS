from django.conf import settings
from django.db import models

from catalog.models import Currency, Destination, SafariType
from crm.models import Client, Lead
from vendors.models import Property, Vendor


class Booking(models.Model):
    class Overall(models.TextChoices):
        NEW = "new", "New"
        ACTIVE = "active", "Active"
        CONFIRMED = "confirmed", "Confirmed"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class SafariStatus(models.TextChoices):
        WAITING_FOR_DECISIONS = "waiting_for_decisions", "Waiting for decisions"
        WAITING_FOR_SAFARI = "waiting_for_safari", "Waiting for safari"
        SAFARI_IN_PROGRESS = "safari_in_progress", "Safari in progress"
        SAFARI_DONE = "safari_done", "Safari done"

    class PayStatus(models.TextChoices):
        NOT_PAID = "not_paid", "Not paid"
        PARTIAL_PAID = "partial_paid", "Partial paid"
        FULLY_PAID = "fully_paid", "Fully paid"

    reference = models.CharField(max_length=20, unique=True, editable=False)
    booking_date = models.DateField()
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="bookings")
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.SET_NULL, related_name="bookings")
    safari_type = models.ForeignKey(SafariType, null=True, blank=True, on_delete=models.SET_NULL)
    destinations = models.ManyToManyField(Destination, blank=True, related_name="bookings")
    start_date = models.DateField()
    end_date = models.DateField()
    adults = models.PositiveIntegerField(default=0)
    children = models.PositiveIntegerField(default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, related_name="bookings")
    overall_status = models.CharField(max_length=20, choices=Overall.choices, default=Overall.NEW)
    safari_status = models.CharField(
        max_length=32, choices=SafariStatus.choices, default=SafariStatus.WAITING_FOR_DECISIONS
    )
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="bookings"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="bookings_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-booking_date", "-id"]

    def __str__(self):
        return self.reference

    @property
    def safari_days(self):
        return (self.end_date - self.start_date).days + 1


class Accommodation(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="accommodations")
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="stays")
    hotel = models.ForeignKey(Property, on_delete=models.PROTECT, related_name="stays")
    check_in = models.DateField()
    check_out = models.DateField()
    room_type = models.CharField(max_length=80, blank=True)
    rooms = models.PositiveIntegerField(default=1)
    agreed_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost_currency = models.ForeignKey(
        Currency, null=True, blank=True, on_delete=models.PROTECT, related_name="stay_costs"
    )
    due_date = models.DateField(null=True, blank=True)
    confirmation_number = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["check_in", "id"]

    def __str__(self):
        return f"{self.hotel} ({self.check_in})"

    @property
    def nights(self):
        return (self.check_out - self.check_in).days


class Quotation(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        EXPIRED = "expired", "Expired"

    number = models.CharField(max_length=20, unique=True, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="quotations")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="quotations")
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    validity_date = models.DateField(null=True, blank=True)
    terms = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    consultant = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="quotations"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="quotations_created"
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class Itinerary(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"

    number = models.CharField(max_length=20, unique=True, editable=False)
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name="itinerary")
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "itineraries"
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class Activity(models.Model):
    class Type(models.TextChoices):
        CALL = "call", "Call"
        EMAIL = "email", "Email"
        WHATSAPP = "whatsapp", "WhatsApp"
        MEETING = "meeting", "Meeting"
        QUOTATION = "quotation", "Quotation"
        FOLLOW_UP = "follow_up", "Follow-up"
        NOTE = "note", "Note"
        OTHER = "other", "Other"

    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.CASCADE, related_name="activities")
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.CASCADE, related_name="activities")
    booking = models.ForeignKey(Booking, null=True, blank=True, on_delete=models.CASCADE, related_name="activities")
    activity_type = models.CharField(max_length=20, choices=Type.choices, default=Type.NOTE)
    body = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="activities"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "activities"

    def __str__(self):
        return self.get_activity_type_display()
