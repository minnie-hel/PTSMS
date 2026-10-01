from django.db import transaction
from django.utils import timezone

from bookings.models import Activity
from common.audit import audit
from common.numbers import next_code
from crm.models import Client, Lead


@transaction.atomic
def create_client_from_lead(lead, user):
    if lead.converted_client_id:
        return lead.converted_client
    client = Client.objects.create(
        reference=next_code(Client, "reference", "CL"),
        full_name=lead.full_name,
        email=lead.email,
        phone=lead.phone,
        whatsapp=lead.whatsapp,
        country=lead.country,
        city=lead.city,
        source=lead.source,
        notes=lead.notes,
        assigned_to=lead.assigned_to,
        created_by=user if getattr(user, "is_authenticated", False) else None,
    )
    lead.converted_client = client
    lead.status = Lead.Status.WON
    lead.save(update_fields=["converted_client", "status", "updated_at"])
    Activity.objects.create(
        lead=lead,
        client=client,
        activity_type=Activity.Type.NOTE,
        body=f"Lead converted to client {client.reference}.",
        created_by=client.created_by,
    )
    name = getattr(user, "full_name", "") or "Staff"
    audit(user, "converted", client, f"{name} converted {lead} to {client}")
    return client


def touch_lead(lead, status=None, user=None, body=""):
    if status:
        lead.status = status
    lead.last_contact = timezone.localdate()
    lead.save(update_fields=["status", "last_contact", "updated_at"])
    if body:
        Activity.objects.create(
            lead=lead,
            client=lead.converted_client,
            activity_type=Activity.Type.NOTE,
            body=body,
            created_by=user if getattr(user, "is_authenticated", False) else None,
        )
