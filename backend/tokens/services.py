
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from places.models import Queue
from .models import Token


# -----------------------------------------
# 1. CREATE NEW TOKEN
# -----------------------------------------

def create_token(queue_id, name):
    service_date = timezone.localdate()

    for attempt in range(5):
        try:
            with transaction.atomic():

                # Find the last token number
                last_token = (
                    Token.objects
                    .filter(
                        queue_id=queue_id,
                        service_date=service_date,
                    )
                    .aggregate(
                        max_number=Max("number")
                    )
                )

                last_number = last_token["max_number"] or 0

                # Generate the next number
                next_number = last_number + 1

                # Create token
                token = Token.objects.create(
                    name=name,
                    queue_id=queue_id,
                    service_date=service_date,
                    number=next_number,
                )

            return token

        except IntegrityError:
            if attempt == 4:
                raise


# -----------------------------------------
# 2. CALL NEXT CUSTOMER
# -----------------------------------------

@transaction.atomic
def call_next(queue_id):
    today = timezone.localdate()
    now = timezone.now()

    # Get and lock the selected queue
    queue = (
        Queue.objects
        .select_for_update()
        .get(id=queue_id)
    )

    # Find the currently serving customer
    current_token = (
        Token.objects
        .filter(
            queue=queue,
            service_date=today,
            status=Token.Status.SERVING,
        )
        .first()
    )

    # Complete the current customer
    if current_token:
        current_token.status = Token.Status.DONE
        current_token.finished_at = now

        current_token.save(
            update_fields=[
                "status",
                "finished_at",
            ]
        )

    # Find the next waiting customer
    next_token = (
        Token.objects
        .filter(
            queue=queue,
            service_date=today,
            status=Token.Status.WAITING,
        )
        .order_by("number")
        .first()
    )

    # No waiting customers
    if not next_token:
        return None

    # Start serving the next customer
    next_token.status = Token.Status.SERVING
    next_token.started_at = now

    next_token.save(
        update_fields=[
            "status",
            "started_at",
        ]
    )

    return next_token
