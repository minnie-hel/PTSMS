from django.db import models


class Currency(models.Model):
    code = models.CharField(max_length=8, unique=True)
    name = models.CharField(max_length=80)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]
        verbose_name_plural = "currencies"

    def __str__(self):
        return self.code


class NamedList(models.Model):
    name = models.CharField(max_length=120, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ["name"]

    def __str__(self):
        return self.name


class PaymentMethod(NamedList):
    pass


class Destination(NamedList):
    pass


class SafariType(NamedList):
    pass


class LeadSource(NamedList):
    pass


class ClientType(NamedList):
    pass


class ExpenseCategory(NamedList):
    pass


class VendorType(NamedList):
    pass


class CompanyProfile(models.Model):
    name = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    address = models.TextField(blank=True)
    tagline = models.CharField(max_length=200, blank=True)
    welcome_title = models.CharField(max_length=200, blank=True)
    welcome_text = models.TextField(blank=True)
    logo = models.ImageField(upload_to="company/", blank=True, null=True)
    primary_color = models.CharField(max_length=7, blank=True)
    secondary_color = models.CharField(max_length=7, blank=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.name
