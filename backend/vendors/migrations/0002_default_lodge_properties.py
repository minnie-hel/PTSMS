from django.db import migrations


def ensure_lodge_properties(apps, schema_editor):
    Vendor = apps.get_model("vendors", "Vendor")
    Property = apps.get_model("vendors", "Property")
    for vendor in Vendor.objects.all():
        if not Property.objects.filter(vendor_id=vendor.id).exists():
            Property.objects.create(
                vendor_id=vendor.id,
                name=vendor.name,
                location=vendor.location or "",
            )


class Migration(migrations.Migration):
    dependencies = [
        ("vendors", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(ensure_lodge_properties, migrations.RunPython.noop),
    ]
