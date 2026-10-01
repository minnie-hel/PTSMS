from rest_framework import viewsets

from accounts.permissions import HasCode
from common.mixins import AuditMixin, ProtectedDestroyMixin
from vendors.models import Vendor
from vendors.serializers import VendorSerializer


class VendorViewSet(AuditMixin, ProtectedDestroyMixin, viewsets.ModelViewSet):
    serializer_class = VendorSerializer
    permission_classes = [HasCode]
    read_permission = "vendors.view"
    write_permission = "vendors.manage"
    search_fields = ["name", "contact_person", "email", "phone", "location"]
    filterset_fields = ["status", "vendor_type"]

    def get_queryset(self):
        return Vendor.objects.select_related("vendor_type", "currency").prefetch_related("properties")
