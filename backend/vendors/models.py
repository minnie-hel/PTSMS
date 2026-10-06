from django.db import models

from catalog.models import Currency, VendorType


class Vendor(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    location = models.CharField(max_length=160, blank=True)
    vendor_type = models.ForeignKey(VendorType, null=True, blank=True, on_delete=models.SET_NULL)
    currency = models.ForeignKey(Currency, null=True, blank=True, on_delete=models.SET_NULL)
    payment_terms = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    bank_account_name = models.CharField(max_length=200, blank=True)
    bank_account_number = models.CharField(max_length=80, blank=True)
    bank_name = models.CharField(max_length=120, blank=True)
    bank_branch = models.CharField(max_length=120, blank=True)
    bank_swift = models.CharField(max_length=40, blank=True)
    bank_iban = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Property(models.Model):
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name="properties")
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=160, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "properties"

    def __str__(self):
        return self.name
