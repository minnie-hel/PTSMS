from django.db import transaction
from django.utils import timezone


def next_code(model, field, prefix, when=None):
    when = when or timezone.localdate()
    stem = f"{prefix}-{when.year}-"
    with transaction.atomic():
        existing = (
            model.objects.select_for_update()
            .filter(**{f"{field}__startswith": stem})
            .order_by(field)
        )
        last = existing.last()
        number = 1
        if last:
            tail = getattr(last, field).rsplit("-", 1)[-1]
            number = int(tail) + 1 if tail.isdigit() else existing.count() + 1
        return f"{stem}{number:04d}"
