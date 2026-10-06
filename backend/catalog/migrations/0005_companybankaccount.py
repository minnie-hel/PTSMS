from django.db import migrations, models
import django.db.models.deletion


def copy_legacy_bank(apps, schema_editor):
    CompanyProfile = apps.get_model("catalog", "CompanyProfile")
    CompanyBankAccount = apps.get_model("catalog", "CompanyBankAccount")
    company = CompanyProfile.objects.filter(pk=1).first()
    if not company:
        return
    if CompanyBankAccount.objects.filter(company=company).exists():
        return
    if not any(
        [
            company.bank_account_name,
            company.bank_account_number,
            company.bank_name,
            company.bank_iban,
            company.bank_swift,
        ]
    ):
        return
    CompanyBankAccount.objects.create(
        company=company,
        account_name=company.bank_account_name,
        account_number=company.bank_account_number,
        iban=company.bank_iban,
        swift=company.bank_swift,
        bank_name=company.bank_name,
        branch=company.bank_branch,
        branch_code=company.bank_branch_code,
        correspondent=company.bank_correspondent,
        correspondent_swift=company.bank_correspondent_swift,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0004_companyprofile_city_country_vrn"),
    ]

    operations = [
        migrations.CreateModel(
            name="CompanyBankAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("account_name", models.CharField(blank=True, max_length=200)),
                ("account_number", models.CharField(blank=True, max_length=80)),
                ("iban", models.CharField(blank=True, max_length=80)),
                ("swift", models.CharField(blank=True, max_length=40)),
                ("bank_name", models.CharField(blank=True, max_length=120)),
                ("branch", models.CharField(blank=True, max_length=120)),
                ("branch_code", models.CharField(blank=True, max_length=40)),
                ("correspondent", models.CharField(blank=True, max_length=200)),
                ("correspondent_swift", models.CharField(blank=True, max_length=40)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="banks",
                        to="catalog.companyprofile",
                    ),
                ),
                (
                    "currency",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="company_banks",
                        to="catalog.currency",
                    ),
                ),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.RunPython(copy_legacy_bank, migrations.RunPython.noop),
    ]
