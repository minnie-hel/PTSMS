from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="invoice",
            name="line_title",
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name="invoice",
            name="line_description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="invoice",
            name="quantity",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="invoice",
            name="attention_to",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="invoice",
            name="contact_person",
            field=models.CharField(blank=True, max_length=200),
        ),
    ]
