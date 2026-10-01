from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasCode
from common.models import AuditLog


class AuditLogView(APIView):
    permission_classes = [HasCode]
    read_permission = "reports.view"

    def get(self, request):
        limit = min(int(request.query_params.get("limit", 200)), 500)
        rows = []
        for row in AuditLog.objects.select_related("actor").order_by("-created_at")[:limit]:
            rows.append(
                {
                    "id": row.id,
                    "when": row.created_at.isoformat(),
                    "actor": row.actor.full_name if row.actor else "",
                    "action": row.action,
                    "entity_type": row.entity_type,
                    "entity_id": row.entity_id,
                    "message": row.message,
                }
            )
        return Response({"results": rows, "count": len(rows)})
