from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("vendors", "0002_default_lodge_properties"),
    ]

    operations = [
        migrations.AddField(
            model_name="vendor",
            name="bank_account_name",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="vendor",
            name="bank_account_number",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="vendor",
            name="bank_branch",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="vendor",
            name="bank_iban",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="vendor",
            name="bank_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="vendor",
            name="bank_swift",
            field=models.CharField(blank=True, max_length=40),
        ),
    ]
