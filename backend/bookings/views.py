from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import HasCode
from bookings.models import Activity, Booking, Itinerary, Quotation
from bookings.serializers import BookingSerializer, ItinerarySerializer, QuotationSerializer
from common.audit import audit
from common.mixins import AuditMixin, ProtectedDestroyMixin
from crm.models import Lead


class BookingViewSet(AuditMixin, ProtectedDestroyMixin, viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [HasCode]
    read_permission = "bookings.view"
    write_permission = "bookings.manage"
    search_fields = ["reference", "client__full_name", "client__country", "notes"]
    filterset_fields = ["overall_status", "safari_type", "client", "currency", "assigned_to"]
    ordering_fields = ["booking_date", "start_date", "reference"]

    def get_queryset(self):
        qs = Booking.objects.select_related(
            "client", "currency", "safari_type", "assigned_to", "lead", "itinerary"
        ).prefetch_related(
            "destinations",
            "accommodations__vendor",
            "accommodations__hotel",
            "accommodations__cost_currency",
            "accommodations__vendor_payments",
            "payments",
            "expenses__currency",
            "quotations",
            "invoices",
        )
        if self.request.query_params.get("operations") == "1":
            qs = qs.filter(overall_status__in=[Booking.Overall.CONFIRMED, Booking.Overall.ACTIVE])
        return qs


class QuotationViewSet(AuditMixin, ProtectedDestroyMixin, viewsets.ModelViewSet):
    serializer_class = QuotationSerializer
    permission_classes = [HasCode]
    read_permission = "quotations.view"
    write_permission = "quotations.manage"
    search_fields = ["number", "client__full_name", "booking__reference"]
    filterset_fields = ["status", "booking", "client"]

    def get_queryset(self):
        return Quotation.objects.select_related(
            "booking", "client", "currency", "consultant", "booking__currency"
        ).prefetch_related("booking__destinations")

    def _actor(self, request):
        return request.user.full_name or request.user.email

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status == Quotation.Status.ACCEPTED:
            return Response({"detail": "This quotation is already accepted."}, status=400)
        quotation.status = Quotation.Status.SENT
        quotation.sent_at = timezone.now()
        quotation.save(update_fields=["status", "sent_at", "updated_at"])
        lead = quotation.booking.lead
        if lead and lead.status not in (Lead.Status.WON, Lead.Status.LOST):
            lead.status = Lead.Status.QUOTATION_SENT
            lead.save(update_fields=["status", "updated_at"])
        Activity.objects.create(
            lead=lead,
            client=quotation.client,
            booking=quotation.booking,
            activity_type=Activity.Type.QUOTATION,
            body=f"Quotation {quotation.number} sent.",
            created_by=request.user,
        )
        audit(request.user, "sent", quotation, f"{self._actor(request)} sent {quotation.number}")
        return Response(self.get_serializer(quotation).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        quotation = self.get_object()
        if quotation.booking.quotations.filter(status=Quotation.Status.ACCEPTED).exclude(pk=quotation.pk).exists():
            return Response({"detail": "Another quotation on this booking is already accepted."}, status=400)
        quotation.status = Quotation.Status.ACCEPTED
        quotation.accepted_at = timezone.now()
        quotation.save(update_fields=["status", "accepted_at", "updated_at"])
        booking = quotation.booking
        if booking.overall_status == Booking.Overall.NEW:
            booking.overall_status = Booking.Overall.ACTIVE
            booking.save(update_fields=["overall_status", "updated_at"])
        if booking.lead_id and booking.lead.status != Lead.Status.WON:
            booking.lead.status = Lead.Status.WON
            booking.lead.save(update_fields=["status", "updated_at"])
        audit(request.user, "accepted", quotation, f"{self._actor(request)} accepted {quotation.number}")
        return Response(self.get_serializer(quotation).data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        quotation = self.get_object()
        quotation.status = Quotation.Status.DECLINED
        quotation.save(update_fields=["status", "updated_at"])
        audit(request.user, "declined", quotation, f"{self._actor(request)} declined {quotation.number}")
        return Response(self.get_serializer(quotation).data)


class ItineraryViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    serializer_class = ItinerarySerializer
    permission_classes = [HasCode]
    read_permission = "itineraries.view"
    write_permission = "itineraries.manage"
    search_fields = ["number", "booking__reference", "booking__client__full_name"]
    filterset_fields = ["status", "booking"]

    def get_queryset(self):
        return Itinerary.objects.select_related("booking", "booking__client", "booking__currency").prefetch_related(
            "booking__destinations", "booking__accommodations__vendor", "booking__accommodations__hotel"
        )

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        itinerary = self.get_object()
        itinerary.status = Itinerary.Status.SENT
        itinerary.sent_at = timezone.now()
        itinerary.save(update_fields=["status", "sent_at", "updated_at"])
        name = request.user.full_name or request.user.email
        audit(request.user, "sent", itinerary, f"{name} sent itinerary {itinerary.number}")
        return Response(self.get_serializer(itinerary).data)
