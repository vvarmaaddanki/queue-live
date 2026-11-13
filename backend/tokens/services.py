from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from places.models import Queue
from .models import Token


def create_token(queue_id, name, phone=""):
    service_date = timezone.localdate()

    for attempt in range(5):
        try:
            with transaction.atomic():
                last_number = (
                    Token.objects.filter(
                        queue_id=queue_id,
                        service_date=service_date,
                    ).aggregate(max_number=Max("number"))["max_number"]
                    or 0
                )
                token = Token.objects.create(
                    name=name,
                    phone=phone,
                    queue_id=queue_id,
                    service_date=service_date,
                    number=last_number + 1,
                )
            return token
        except IntegrityError:
            if attempt == 4:
                raise


@transaction.atomic
def call_next(queue_id):
    today = timezone.localdate()
    now = timezone.now()
    queue = Queue.objects.select_for_update().get(id=queue_id)

    current_token = (
        Token.objects.filter(
            queue=queue,
            service_date=today,
            status=Token.Status.SERVING,
        ).first()
    )
    if current_token:
        current_token.status = Token.Status.DONE
        current_token.finished_at = now
        current_token.save(update_fields=["status", "finished_at"])

    next_token = (
        Token.objects.filter(
            queue=queue,
            service_date=today,
            status=Token.Status.WAITING,
        ).order_by("number").first()
    )
    if not next_token:
        return None

    next_token.status = Token.Status.SERVING
    next_token.started_at = now
    next_token.save(update_fields=["status", "started_at"])
    return next_token
