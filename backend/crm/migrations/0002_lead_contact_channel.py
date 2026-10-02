from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="lead",
            name="contact_channel",
            field=models.CharField(
                blank=True,
                choices=[
                    ("email", "Email"),
                    ("whatsapp", "WhatsApp"),
                    ("phone", "Phone call"),
                    ("website", "Website / form"),
                    ("referral", "Referral"),
                    ("other", "Other"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="lead",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "New inquiry"),
                    ("contacted", "In contact"),
                    ("qualified", "Qualified"),
                    ("quotation_sent", "Quotation sent"),
                    ("follow_up", "Follow-up needed"),
                    ("negotiation", "Negotiating"),
                    ("won", "Won — booking opened"),
                    ("lost", "Lost"),
                    ("unqualified", "Not a fit"),
                ],
                default="new",
                max_length=32,
            ),
        ),
    ]
