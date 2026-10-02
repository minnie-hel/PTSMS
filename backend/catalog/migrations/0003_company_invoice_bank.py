from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_companyprofile_logo_companyprofile_primary_color_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="companyprofile",
            name="tin_number",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="bank_account_name",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="bank_account_number",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="bank_iban",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="bank_swift",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="bank_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="bank_branch",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="bank_branch_code",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="bank_correspondent",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="bank_correspondent_swift",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="invoice_terms",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="invoice_footer",
            field=models.TextField(blank=True),
        ),
    ]
