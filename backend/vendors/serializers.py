from decimal import Decimal

from rest_framework import serializers

from bookings.services import stay_paid, stay_payment_status
from vendors.models import Property, Vendor


class PropertySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Property
        fields = ["id", "name", "location", "notes"]


class VendorSerializer(serializers.ModelSerializer):
    properties = PropertySerializer(many=True, required=False)
    type_name = serializers.CharField(source="vendor_type.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    owed = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            "id",
            "name",
            "contact_person",
            "email",
            "phone",
            "location",
            "vendor_type",
            "type_name",
            "currency",
            "currency_code",
            "payment_terms",
            "notes",
            "status",
            "status_label",
            "properties",
            "owed",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_owed(self, vendor):
        user = self.context["request"].user
        if not user.has_code("costs.view"):
            return []
        buckets = {}
        for stay in vendor.stays.select_related("cost_currency").prefetch_related("vendor_payments"):
            if not stay.cost_currency_id:
                continue
            owed = (stay.agreed_cost or Decimal("0")) - stay_paid(stay)
            if owed > 0:
                code = stay.cost_currency.code
                buckets[code] = buckets.get(code, Decimal("0")) + owed
        return [{"currency": code, "amount": amount} for code, amount in buckets.items()]

    def create(self, validated):
        properties = validated.pop("properties", [])
        vendor = Vendor.objects.create(**validated)
        for row in properties:
            row.pop("id", None)
            Property.objects.create(vendor=vendor, **row)
        return vendor

    def update(self, instance, validated):
        properties = validated.pop("properties", None)
        for key, value in validated.items():
            setattr(instance, key, value)
        instance.save()
        if properties is not None:
            keep = []
            for row in properties:
                prop_id = row.pop("id", None)
                if prop_id:
                    prop = instance.properties.get(pk=prop_id)
                    for key, value in row.items():
                        setattr(prop, key, value)
                    prop.save()
                    keep.append(prop.id)
                else:
                    keep.append(Property.objects.create(vendor=instance, **row).id)
            instance.properties.exclude(id__in=keep).delete()
        return instance
