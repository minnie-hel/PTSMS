from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasAnyCode, HasCode
from bookings.models import Activity
from common.mixins import AuditMixin, ProtectedDestroyMixin
from crm.models import Client, Lead
from crm.profile import build_client_profile
from crm.serializers import ActivitySerializer, ClientSerializer, LeadConvertSerializer, LeadSerializer


class LeadViewSet(AuditMixin, ProtectedDestroyMixin, viewsets.ModelViewSet):
    serializer_class = LeadSerializer
    permission_classes = [HasCode]
    read_permission = "leads.view"
    write_permission = "leads.manage"
    search_fields = ["reference", "full_name", "email", "phone", "whatsapp", "country"]
    filterset_fields = ["status", "priority", "source", "assigned_to", "safari_type"]
    ordering_fields = ["created_at", "full_name", "next_follow_up"]

    def get_queryset(self):
        return Lead.objects.select_related(
            "safari_type", "currency", "source", "assigned_to", "converted_client"
        ).prefetch_related("destinations")

    @action(detail=True, methods=["post"])
    def convert(self, request, pk=None):
        lead = self.get_object()
        if not request.user.has_code("clients.create"):
            return Response({"detail": "You cannot create clients."}, status=403)
        serializer = LeadConvertSerializer(data={}, context={"lead": lead, "request": request})
        serializer.is_valid(raise_exception=True)
        client = serializer.save()
        return Response(ClientSerializer(client, context={"request": request}).data)


class ClientViewSet(AuditMixin, ProtectedDestroyMixin, viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [HasCode]
    read_permission = "clients.view"
    write_permission = "clients.manage"
    search_fields = ["reference", "full_name", "email", "phone", "country"]
    filterset_fields = ["status", "source", "client_type", "assigned_to"]

    def get_queryset(self):
        return Client.objects.select_related("client_type", "source", "assigned_to")

    @action(detail=True, methods=["get"])
    def profile(self, request, pk=None):
        client = self.get_object()
        return Response(build_client_profile(client, request.user))


class ActivityViewSet(viewsets.ModelViewSet):
    serializer_class = ActivitySerializer
    permission_classes = [HasAnyCode]
    any_permissions = ["leads.view", "clients.view", "bookings.view"]
    filterset_fields = ["lead", "client", "booking", "activity_type"]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return Activity.objects.select_related("created_by", "lead", "client")

    def create(self, request, *args, **kwargs):
        if not request.user.has_code("leads.create") and not request.user.has_code("bookings.create"):
            return Response({"detail": "You cannot record activities."}, status=403)
        return super().create(request, *args, **kwargs)


class FollowUpView(APIView):
    permission_classes = [HasAnyCode]
    any_permissions = ["leads.view", "clients.view"]

    def get(self, request):
        today = timezone.localdate()
        rows = []
        leads = Lead.objects.exclude(next_follow_up=None).exclude(status__in=[Lead.Status.WON, Lead.Status.LOST, Lead.Status.UNQUALIFIED])
        for lead in leads:
            rows.append(
                {
                    "kind": "lead",
                    "id": lead.id,
                    "name": lead.full_name,
                    "reference": lead.reference,
                    "date": lead.next_follow_up,
                    "state": "overdue" if lead.next_follow_up < today else "due" if lead.next_follow_up == today else "upcoming",
                }
            )
        clients = Client.objects.exclude(next_follow_up=None)
        for client in clients:
            rows.append(
                {
                    "kind": "client",
                    "id": client.id,
                    "name": client.full_name,
                    "reference": client.reference,
                    "date": client.next_follow_up,
                    "state": "overdue" if client.next_follow_up < today else "due" if client.next_follow_up == today else "upcoming",
                }
            )
        rows.sort(key=lambda row: row["date"])
        return Response(rows)
