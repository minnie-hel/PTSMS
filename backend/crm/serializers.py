from django.db import transaction
from rest_framework import serializers

from bookings.models import Activity
from catalog.models import Destination
from common.numbers import next_code
from crm.models import Client, Lead
from crm.services import create_client_from_lead


class ActivitySerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_activity_type_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = Activity
        fields = [
            "id",
            "lead",
            "client",
            "booking",
            "activity_type",
            "type_label",
            "body",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["created_by", "created_at"]

    def validate(self, data):
        if not any(data.get(key) or getattr(self.instance, key, None) for key in ("lead", "client", "booking")):
            raise serializers.ValidationError("Link the activity to a lead, client, or booking.")
        return data

    def create(self, validated):
        validated["created_by"] = self.context["request"].user
        activity = super().create(validated)
        if activity.lead_id and activity.activity_type == Activity.Type.FOLLOW_UP:
            activity.lead.last_contact = activity.created_at.date()
            activity.lead.save(update_fields=["last_contact", "updated_at"])
        return activity


class LeadSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    assigned_name = serializers.CharField(source="assigned_to.full_name", read_only=True)
    source_name = serializers.CharField(source="source.name", read_only=True)
    safari_type_name = serializers.CharField(source="safari_type.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    destination_ids = serializers.PrimaryKeyRelatedField(
        source="destinations", many=True, queryset=Destination.objects.all(), required=False
    )
    destination_names = serializers.SerializerMethodField()
    client_reference = serializers.CharField(source="converted_client.reference", read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "reference",
            "full_name",
            "email",
            "phone",
            "whatsapp",
            "country",
            "city",
            "travel_date",
            "adults",
            "children",
            "destination_ids",
            "destination_names",
            "safari_type",
            "safari_type_name",
            "budget",
            "currency",
            "currency_code",
            "source",
            "source_name",
            "campaign",
            "assigned_to",
            "assigned_name",
            "status",
            "status_label",
            "priority",
            "priority_label",
            "last_contact",
            "next_follow_up",
            "notes",
            "converted_client",
            "client_reference",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["reference", "converted_client", "created_at", "updated_at"]

    def get_destination_names(self, obj):
        return [item.name for item in obj.destinations.all()]

    @transaction.atomic
    def create(self, validated):
        destinations = validated.pop("destinations", [])
        validated["reference"] = next_code(Lead, "reference", "LD")
        validated["created_by"] = self.context["request"].user
        lead = Lead.objects.create(**validated)
        lead.destinations.set(destinations)
        return lead

    @transaction.atomic
    def update(self, instance, validated):
        destinations = validated.pop("destinations", None)
        for key, value in validated.items():
            setattr(instance, key, value)
        instance.save()
        if destinations is not None:
            instance.destinations.set(destinations)
        return instance


class ClientSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    assigned_name = serializers.CharField(source="assigned_to.full_name", read_only=True)
    type_name = serializers.CharField(source="client_type.name", read_only=True)
    source_name = serializers.CharField(source="source.name", read_only=True)
    booking_count = serializers.IntegerField(source="bookings.count", read_only=True)

    class Meta:
        model = Client
        fields = [
            "id",
            "reference",
            "full_name",
            "contact_person",
            "email",
            "phone",
            "whatsapp",
            "country",
            "city",
            "address",
            "client_type",
            "type_name",
            "source",
            "source_name",
            "notes",
            "assigned_to",
            "assigned_name",
            "status",
            "status_label",
            "next_follow_up",
            "booking_count",
            "created_at",
        ]
        read_only_fields = ["reference", "created_at"]

    @transaction.atomic
    def create(self, validated):
        validated["reference"] = next_code(Client, "reference", "CL")
        validated["created_by"] = self.context["request"].user
        return super().create(validated)


class LeadConvertSerializer(serializers.Serializer):
    def save(self, **kwargs):
        return create_client_from_lead(self.context["lead"], self.context["request"].user)
