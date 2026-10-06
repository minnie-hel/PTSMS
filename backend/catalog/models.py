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
    city = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=2, blank=True, default="TZ")
    vrn_number = models.CharField(max_length=40, blank=True)
    address = models.TextField(blank=True)
    tagline = models.CharField(max_length=200, blank=True)
    welcome_title = models.CharField(max_length=200, blank=True)
    welcome_text = models.TextField(blank=True)
    logo = models.ImageField(upload_to="company/", blank=True, null=True)
    primary_color = models.CharField(max_length=7, blank=True)
    secondary_color = models.CharField(max_length=7, blank=True)
    tin_number = models.CharField(max_length=40, blank=True)
    bank_account_name = models.CharField(max_length=200, blank=True)
    bank_account_number = models.CharField(max_length=80, blank=True)
    bank_iban = models.CharField(max_length=80, blank=True)
    bank_swift = models.CharField(max_length=40, blank=True)
    bank_name = models.CharField(max_length=120, blank=True)
    bank_branch = models.CharField(max_length=120, blank=True)
    bank_branch_code = models.CharField(max_length=40, blank=True)
    bank_correspondent = models.CharField(max_length=200, blank=True)
    bank_correspondent_swift = models.CharField(max_length=40, blank=True)
    invoice_terms = models.TextField(blank=True)
    invoice_footer = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.name


class CompanyBankAccount(models.Model):
    company = models.ForeignKey(CompanyProfile, on_delete=models.CASCADE, related_name="banks")
    currency = models.ForeignKey(Currency, null=True, blank=True, on_delete=models.SET_NULL, related_name="company_banks")
    account_name = models.CharField(max_length=200, blank=True)
    account_number = models.CharField(max_length=80, blank=True)
    iban = models.CharField(max_length=80, blank=True)
    swift = models.CharField(max_length=40, blank=True)
    bank_name = models.CharField(max_length=120, blank=True)
    branch = models.CharField(max_length=120, blank=True)
    branch_code = models.CharField(max_length=40, blank=True)
    correspondent = models.CharField(max_length=200, blank=True)
    correspondent_swift = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        code = self.currency.code if self.currency_id else "—"
        return f"{self.bank_name or 'Bank'} ({code})"
