from decimal import Decimal

from rest_framework import serializers

from bookings.services import stay_paid, stay_payment_status
from vendors.models import Property, Vendor
from vendors.services import default_lodge_property, sync_lodge_property


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
            "bank_account_name",
            "bank_account_number",
            "bank_name",
            "bank_branch",
            "bank_swift",
            "bank_iban",
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
        validated.pop("properties", None)
        vendor = Vendor.objects.create(**validated)
        default_lodge_property(vendor)
        return vendor

    def update(self, instance, validated):
        validated.pop("properties", None)
        for key, value in validated.items():
            setattr(instance, key, value)
        instance.save()
        sync_lodge_property(instance)
        return instance
