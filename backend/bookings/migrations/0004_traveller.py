from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Traveller",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(max_length=200)),
                ("nationality", models.CharField(blank=True, max_length=80)),
                ("date_of_birth", models.DateField(blank=True, null=True)),
                ("passport_number", models.CharField(blank=True, max_length=40)),
                ("passport_expiry", models.DateField(blank=True, null=True)),
                ("gender", models.CharField(blank=True, max_length=20)),
                ("dietary_requirements", models.TextField(blank=True)),
                ("medical_notes", models.TextField(blank=True)),
                ("emergency_contact", models.CharField(blank=True, max_length=200)),
                (
                    "booking",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="travellers", to="bookings.booking"),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
    ]
