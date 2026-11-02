from django.db import transaction
from django.utils import timezone

from .models import Token


@transaction.atomic
def create_token(queue, customer_name, phone=""):
    service_date = timezone.localdate()

    last_token = (
        Token.objects
        .filter(
            queue=queue,
            service_date=service_date,
        )
        .order_by("-number")
        .first()
    )

    next_number = (
        last_token.number + 1
        if last_token
        else 1
    )

    token = Token.objects.create(
        queue=queue,
        service_date=service_date,
        number=next_number,
        customer_name=customer_name,
        phone=phone,
        status=Token.Status.WAITING,
    )

    return token