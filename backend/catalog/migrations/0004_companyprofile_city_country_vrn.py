from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0003_company_invoice_bank"),
    ]

    operations = [
        migrations.AddField(
            model_name="companyprofile",
            name="city",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="country",
            field=models.CharField(blank=True, default="TZ", max_length=2),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="vrn_number",
            field=models.CharField(blank=True, max_length=40),
        ),
    ]
