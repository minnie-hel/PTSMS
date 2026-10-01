from django.db.models import ProtectedError
from rest_framework.response import Response

from common.audit import audit


class AuditMixin:
    audit_label = "record"

    def perform_create(self, serializer):
        obj = serializer.save()
        name = self.request.user.full_name or self.request.user.email
        audit(self.request.user, "created", obj, f"{name} created {obj}")
        return obj

    def perform_update(self, serializer):
        obj = serializer.save()
        name = self.request.user.full_name or self.request.user.email
        audit(self.request.user, "updated", obj, f"{name} updated {obj}")
        return obj


class ProtectedDestroyMixin:
    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "This record is used elsewhere and cannot be deleted."},
                status=400,
            )
