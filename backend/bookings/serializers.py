from django.db import transaction
from django.db.models import ProtectedError
from django.utils import timezone
from rest_framework import serializers

from bookings.models import Accommodation, Activity, Booking, Itinerary, Quotation, Traveller
from bookings.services import resolved_safari_status, stay_paid, stay_payment_status, vendor_payment_summary
from catalog.models import Destination
from common.audit import audit
from common.numbers import next_code
from crm.models import Client, Lead
from crm.services import create_client_from_lead
from finance.models import Invoice
from finance.services import booking_profit, client_payment_summary
from vendors.services import default_lodge_property


class AccommodationSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    property_name = serializers.CharField(source="hotel.name", read_only=True)
    cost_currency_code = serializers.CharField(source="cost_currency.code", read_only=True)
    nights = serializers.IntegerField(read_only=True)
    amount_paid = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = Accommodation
        fields = [
            "id",
            "booking",
            "booking_reference",
            "vendor",
            "vendor_name",
            "hotel",
            "property_name",
            "check_in",
            "check_out",
            "nights",
            "room_type",
            "rooms",
            "agreed_cost",
            "cost_currency",
            "cost_currency_code",
            "due_date",
            "confirmation_number",
            "notes",
            "amount_paid",
            "payment_status",
        ]
        extra_kwargs = {
            "hotel": {"required": False, "allow_null": True},
            "booking": {"required": False},
        }

    def get_amount_paid(self, stay):
        return stay_paid(stay)

    def get_payment_status(self, stay):
        return stay_payment_status(stay)

    def validate(self, data):
        vendor = data.get("vendor") or getattr(self.instance, "vendor", None)
        hotel = data.get("hotel") or getattr(self.instance, "hotel", None)
        if hotel and vendor and hotel.vendor_id != vendor.id:
            raise serializers.ValidationError({"hotel": "That property belongs to a different hotel owner."})
        check_in = data.get("check_in") or getattr(self.instance, "check_in", None)
        check_out = data.get("check_out") or getattr(self.instance, "check_out", None)
        if check_in and check_out and check_out <= check_in:
            raise serializers.ValidationError({"check_out": "Check-out must be after check-in."})
        cost = data.get("agreed_cost", getattr(self.instance, "agreed_cost", 0))
        currency = data.get("cost_currency", getattr(self.instance, "cost_currency", None))
        if cost and not currency:
            raise serializers.ValidationError({"cost_currency": "Choose the currency of the hotel cost."})
        if vendor and not hotel:
            data["hotel"] = default_lodge_property(vendor)
        return data


class TravellerSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Traveller
        fields = [
            "id",
            "full_name",
            "nationality",
            "date_of_birth",
            "passport_number",
            "passport_expiry",
            "gender",
            "dietary_requirements",
            "medical_notes",
            "emergency_contact",
        ]
        extra_kwargs = {"booking": {"required": False}}


class BookingSerializer(serializers.ModelSerializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all(), required=False, allow_null=True)
    destination_ids = serializers.PrimaryKeyRelatedField(
        source="destinations", many=True, queryset=Destination.objects.all(), required=False
    )
    destination_names = serializers.SerializerMethodField()
    accommodations = AccommodationSerializer(many=True, required=False)
    travellers = TravellerSerializer(many=True, required=False)
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    client_country = serializers.CharField(source="client.country", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    safari_type_name = serializers.CharField(source="safari_type.name", read_only=True)
    assigned_name = serializers.CharField(source="assigned_to.full_name", read_only=True)
    overall_label = serializers.CharField(source="get_overall_status_display", read_only=True)
    safari_days = serializers.IntegerField(read_only=True)
    client_payment_status = serializers.SerializerMethodField()
    vendor_payment_status = serializers.SerializerMethodField()
    amount_paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    profit = serializers.SerializerMethodField()
    quotation_id = serializers.SerializerMethodField()
    itinerary_id = serializers.SerializerMethodField()
    invoice_id = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "reference",
            "booking_date",
            "client",
            "client_name",
            "client_country",
            "lead",
            "safari_type",
            "safari_type_name",
            "destination_ids",
            "destination_names",
            "start_date",
            "end_date",
            "safari_days",
            "adults",
            "children",
            "total_amount",
            "currency",
            "currency_code",
            "overall_status",
            "overall_label",
            "safari_status",
            "notes",
            "assigned_to",
            "assigned_name",
            "accommodations",
            "travellers",
            "client_payment_status",
            "vendor_payment_status",
            "amount_paid",
            "balance",
            "profit",
            "quotation_id",
            "itinerary_id",
            "invoice_id",
            "created_at",
        ]
        read_only_fields = ["reference", "created_at"]

    def get_destination_names(self, booking):
        return [item.name for item in booking.destinations.all()]

    def get_client_payment_status(self, booking):
        return client_payment_summary(booking)["status"]

    def get_vendor_payment_status(self, booking):
        return vendor_payment_summary(booking)["status"]

    def get_amount_paid(self, booking):
        return client_payment_summary(booking)["paid"]

    def get_balance(self, booking):
        return client_payment_summary(booking)["balance"]

    def get_profit(self, booking):
        user = self.context["request"].user
        if not user.has_code("profitability.view"):
            return None
        return booking_profit(booking)

    def get_quotation_id(self, booking):
        accepted = next((item.id for item in booking.quotations.all() if item.status == Quotation.Status.ACCEPTED), None)
        if accepted:
            return accepted
        items = list(booking.quotations.all())
        return items[0].id if items else None

    def get_itinerary_id(self, booking):
        try:
            return booking.itinerary.id
        except Itinerary.DoesNotExist:
            return None

    def get_invoice_id(self, booking):
        invoices = [item for item in booking.invoices.all() if item.status != "cancelled"]
        return invoices[0].id if invoices else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["safari_status_stored"] = instance.safari_status
        data["safari_status"] = resolved_safari_status(instance)
        user = self.context["request"].user
        if not user.has_code("costs.view"):
            for stay in data.get("accommodations", []):
                stay["agreed_cost"] = None
                stay["amount_paid"] = None
                stay["cost_currency"] = None
                stay["cost_currency_code"] = None
        if not user.has_code("bookings.edit"):
            for traveller in data.get("travellers", []):
                traveller["passport_number"] = None
                traveller["passport_expiry"] = None
                traveller["medical_notes"] = None
        return data

    def validate(self, data):
        start = data.get("start_date") or getattr(self.instance, "start_date", None)
        end = data.get("end_date") or getattr(self.instance, "end_date", None)
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before the start date."})
        if not self.instance and not data.get("client") and not data.get("lead"):
            raise serializers.ValidationError("Choose a client, or a lead so the client can be created.")
        overall = data.get("overall_status") or getattr(self.instance, "overall_status", None)
        if overall == Booking.Overall.COMPLETED:
            booking = self.instance
            if booking and not booking.invoices.exclude(status=Invoice.Status.CANCELLED).exists():
                raise serializers.ValidationError(
                    {"overall_status": "Create an invoice on this booking before marking it completed."}
                )
        return data

    def _visible_costs(self, stays):
        user = self.context["request"].user
        if user.has_code("costs.view") or user.has_code("costs.manage"):
            return stays
        for row in stays:
            row.pop("agreed_cost", None)
            row.pop("cost_currency", None)
        return stays

    def _sync_travellers(self, booking, rows):
        keep = []
        for row in rows:
            traveller_id = row.pop("id", None)
            if traveller_id:
                traveller = booking.travellers.get(pk=traveller_id)
                for key, value in row.items():
                    setattr(traveller, key, value)
                traveller.save()
                keep.append(traveller.id)
            else:
                keep.append(Traveller.objects.create(booking=booking, **row).id)
        booking.travellers.exclude(id__in=keep or [0]).delete()

    def _sync_stays(self, booking, stays):
        stays = self._visible_costs(stays)
        keep = []
        for row in stays:
            stay_id = row.pop("id", None)
            if stay_id:
                stay = booking.accommodations.get(pk=stay_id)
                for key, value in row.items():
                    setattr(stay, key, value)
                stay.save()
                keep.append(stay.id)
            else:
                keep.append(Accommodation.objects.create(booking=booking, **row).id)
        try:
            booking.accommodations.exclude(id__in=keep or [0]).delete()
        except ProtectedError as exc:
            raise serializers.ValidationError(
                "A stay with a vendor payment cannot be removed. Record the payment against the stay, or leave the stay in place."
            ) from exc

    def _attach_client(self, validated):
        lead = validated.get("lead")
        client = validated.get("client")
        user = self.context["request"].user
        if client:
            if lead and not lead.converted_client_id:
                lead.converted_client = client
                lead.status = Lead.Status.WON
                lead.save(update_fields=["converted_client", "status", "updated_at"])
            return validated
        if lead and lead.converted_client_id:
            validated["client"] = lead.converted_client
            return validated
        if lead:
            validated["client"] = create_client_from_lead(lead, user)
            return validated
        raise serializers.ValidationError("Choose a client, or a lead so the client can be created.")

    @transaction.atomic
    def create(self, validated):
        destinations = validated.pop("destinations", [])
        stays = self._visible_costs(validated.pop("accommodations", []))
        travellers = validated.pop("travellers", [])
        validated = self._attach_client(validated)
        lead = validated.get("lead")
        if lead and not validated.get("assigned_to") and lead.assigned_to_id:
            validated["assigned_to"] = lead.assigned_to
        validated["reference"] = next_code(Booking, "reference", "PTS", validated.get("booking_date"))
        validated["created_by"] = self.context["request"].user
        booking = Booking.objects.create(**validated)
        booking.destinations.set(destinations)
        for row in stays:
            row.pop("id", None)
            Accommodation.objects.create(booking=booking, **row)
        for row in travellers:
            row.pop("id", None)
            Traveller.objects.create(booking=booking, **row)
        if lead and lead.status != Lead.Status.WON:
            lead.status = Lead.Status.WON
            lead.save(update_fields=["status", "updated_at"])
        if lead:
            Activity.objects.create(
                lead=lead,
                client=booking.client,
                booking=booking,
                activity_type=Activity.Type.NOTE,
                body=f"Booking {booking.reference} opened.",
                created_by=validated["created_by"],
            )
        return booking

    @transaction.atomic
    def update(self, instance, validated):
        destinations = validated.pop("destinations", None)
        stays = validated.pop("accommodations", None)
        travellers = validated.pop("travellers", None)
        validated.pop("lead", None)
        validated.pop("client", None) if "client" in validated and instance.payments.exists() else None
        for key, value in validated.items():
            setattr(instance, key, value)
        instance.save()
        if destinations is not None:
            instance.destinations.set(destinations)
        if stays is not None:
            self._sync_stays(instance, stays)
        if travellers is not None:
            self._sync_travellers(instance, travellers)
        return instance


class QuotationSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    status_label = serializers.SerializerMethodField()
    consultant_name = serializers.CharField(source="consultant.full_name", read_only=True)
    start_date = serializers.DateField(source="booking.start_date", read_only=True)
    end_date = serializers.DateField(source="booking.end_date", read_only=True)
    destination_names = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = [
            "id",
            "number",
            "booking",
            "booking_reference",
            "client",
            "client_name",
            "total_amount",
            "currency",
            "currency_code",
            "validity_date",
            "terms",
            "notes",
            "status",
            "status_label",
            "consultant",
            "consultant_name",
            "start_date",
            "end_date",
            "destination_names",
            "sent_at",
            "accepted_at",
            "created_at",
        ]
        read_only_fields = ["number", "client", "status", "sent_at", "accepted_at", "created_at"]

    def get_destination_names(self, quotation):
        return [item.name for item in quotation.booking.destinations.all()]

    def get_status_label(self, quotation):
        if (
            quotation.status in (Quotation.Status.DRAFT, Quotation.Status.SENT)
            and quotation.validity_date
            and quotation.validity_date < timezone.localdate()
        ):
            return "Expired"
        return quotation.get_status_display()

    def validate(self, data):
        booking = data.get("booking") or getattr(self.instance, "booking", None)
        if booking and not self.instance:
            active = booking.quotations.exclude(status=Quotation.Status.DECLINED)
            if active.exists():
                raise serializers.ValidationError(
                    "This booking already has a quotation. Open it from the booking or quotation list."
                )
        return data

    @transaction.atomic
    def create(self, validated):
        booking = validated["booking"]
        if booking.quotations.exclude(status=Quotation.Status.DECLINED).exists():
            raise serializers.ValidationError(
                "This booking already has a quotation. Open it from the booking or quotation list."
            )
        validated["client"] = booking.client
        validated.setdefault("total_amount", booking.total_amount)
        validated.setdefault("currency", booking.currency)
        validated.setdefault("consultant", booking.assigned_to)
        validated["number"] = next_code(Quotation, "number", "QT")
        validated["created_by"] = self.context["request"].user
        return super().create(validated)


class ItinerarySerializer(serializers.ModelSerializer):
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    client_name = serializers.CharField(source="booking.client.full_name", read_only=True)
    start_date = serializers.DateField(source="booking.start_date", read_only=True)
    end_date = serializers.DateField(source="booking.end_date", read_only=True)
    safari_days = serializers.IntegerField(source="booking.safari_days", read_only=True)
    total_amount = serializers.DecimalField(source="booking.total_amount", max_digits=14, decimal_places=2, read_only=True)
    currency_code = serializers.CharField(source="booking.currency.code", read_only=True)
    destination_names = serializers.SerializerMethodField()
    stays = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Itinerary
        fields = [
            "id",
            "number",
            "booking",
            "booking_reference",
            "client_name",
            "start_date",
            "end_date",
            "safari_days",
            "destination_names",
            "stays",
            "total_amount",
            "currency_code",
            "notes",
            "status",
            "status_label",
            "sent_at",
            "created_at",
        ]
        read_only_fields = ["number", "status", "sent_at", "created_at"]

    def get_destination_names(self, itinerary):
        return [item.name for item in itinerary.booking.destinations.all()]

    def get_stays(self, itinerary):
        rows = []
        for stay in itinerary.booking.accommodations.select_related("vendor", "hotel"):
            rows.append(
                {
                    "property": stay.hotel.name,
                    "vendor": stay.vendor.name,
                    "check_in": stay.check_in,
                    "check_out": stay.check_out,
                    "nights": stay.nights,
                    "room_type": stay.room_type,
                    "rooms": stay.rooms,
                }
            )
        return rows

    @transaction.atomic
    def create(self, validated):
        booking = validated["booking"]
        if not booking.quotations.filter(status=Quotation.Status.ACCEPTED).exists():
            raise serializers.ValidationError("Accept the quotation before writing the itinerary.")
        if Itinerary.objects.filter(booking=booking).exists():
            raise serializers.ValidationError("This booking already has an itinerary.")
        validated["number"] = next_code(Itinerary, "number", "IT")
        validated["created_by"] = self.context["request"].user
        itinerary = super().create(validated)
        user = self.context["request"].user
        audit(user, "created", itinerary, f"{user.full_name} created itinerary {itinerary.number}")
        return itinerary
