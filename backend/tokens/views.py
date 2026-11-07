import json

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser

from places.models import Queue
from .models import Token
from .services import create_token, call_next


# -----------------------------------
# WebSocket: Broadcast queue updates
# -----------------------------------

def broadcast_queue_update(queue_id, data):
    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f"queue_{queue_id}",
        {
            "type": "queue_update",
            "data": data,
        },
    )


# -----------------------------------
# Health check
# -----------------------------------

@csrf_exempt
@require_GET
def health_check_view(request):
    return JsonResponse({"status": "ok"})


# -----------------------------------
# Customer: Generate a queue token
# -----------------------------------


@csrf_exempt
@require_POST
def create_token_view(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse(
            {"error": "Invalid JSON"},
            status=400,
        )

    name = data.get("name")
    queue_id = data.get("queue_id")

    if not isinstance(name, str) or not name.strip():
        return JsonResponse(
            {"error": "Name is required"},
            status=400,
        )

    # Validate the UUID queue ID
    try:
        import uuid

        queue_uuid = uuid.UUID(str(queue_id))
        queue = Queue.objects.get(id=queue_uuid)
    except (ValueError, TypeError, Queue.DoesNotExist):
        return JsonResponse(
            {"error": "A valid queue_id is required"},
            status=400,
        )

    try:
        token = create_token(
            queue_id=queue.id,
            name=name.strip(),
        )
    except Exception:
        return JsonResponse(
            {"error": "Unable to generate token"},
            status=500,
        )

    return JsonResponse(
        {
            "message": "Token created successfully",
            "token_id": token.id,
            "name": token.name,
            "queue_id": str(token.queue_id),
            "service_date": str(token.service_date),
            "number": token.number,
            "status": token.status,
        },
        status=201,
    )



# -----------------------------------
# Staff: Call next customer
# Requires authenticated staff user
# -----------------------------------

@api_view(["POST"])
@permission_classes([IsAdminUser])
def call_next_view(request, queue_id):
    queue = get_object_or_404(
        Queue,
        id=queue_id,
    )

    token = call_next(queue.id)

    if token is None:
        return JsonResponse(
            {"message": "No waiting customers"},
            status=200,
        )

    broadcast_queue_update(
        token.queue_id,
        {
            "event": "token_called",
            "token_id": token.id,
            "number": token.number,
            "status": token.status,
        },
    )

    return JsonResponse(
        {
            "message": "Next customer called",
            "token_id": token.id,
            "name": token.name,
            "queue_id": token.queue_id,
            "number": token.number,
            "status": token.status,
            "started_at": (
                token.started_at.isoformat()
                if token.started_at
                else None
            ),
        },
        status=200,
    )


# -----------------------------------
# Customer: Check token status
# -----------------------------------

@require_GET
def token_status_view(request, token_id):
    token = get_object_or_404(
        Token,
        id=token_id,
    )

    customers_ahead = 0

    if token.status == Token.Status.WAITING:
        customers_ahead = Token.objects.filter(
            queue_id=token.queue_id,
            service_date=token.service_date,
            status=Token.Status.WAITING,
            number__lt=token.number,
        ).count()

    estimated_wait_minutes = 0

    if token.status == Token.Status.WAITING:
        if token.queue:
            average_minutes = token.queue.average_minutes()
        else:
            average_minutes = 10

        estimated_wait_minutes = (
            customers_ahead * average_minutes
        )

    return JsonResponse(
        {
            "token_id": token.id,
            "name": token.name,
            "queue_id": token.queue_id,
            "token_number": token.number,
            "service_date": str(token.service_date),
            "status": token.status,
            "customers_ahead": customers_ahead,
            "estimated_wait_minutes": estimated_wait_minutes,
            "started_at": (
                token.started_at.isoformat()
                if token.started_at
                else None
            ),
            "finished_at": (
                token.finished_at.isoformat()
                if token.finished_at
                else None
            ),
        },
        status=200,
    )


# -----------------------------------
# Staff dashboard: Get queue tokens
# -----------------------------------

@require_GET
def queue_tokens_view(request, queue_id):
    queue = get_object_or_404(
        Queue,
        id=queue_id,
    )

    service_date = timezone.localdate()

    tokens = Token.objects.filter(
        queue=queue,
        service_date=service_date,
    ).order_by("number")

    return JsonResponse(
        {
            "queue_id": queue.id,
            "queue_name": queue.name,
            "tokens": [
                {
                    "token_id": token.id,
                    "name": token.name,
                    "number": token.number,
                    "status": token.status,
                    "started_at": (
                        token.started_at.isoformat()
                        if token.started_at
                        else None
                    ),
                    "finished_at": (
                        token.finished_at.isoformat()
                        if token.finished_at
                        else None
                    ),
                }
                for token in tokens
            ],
        }
    )


# -----------------------------------
# Staff: Complete a serving token
# Requires authenticated staff user
# -----------------------------------

@api_view(["POST"])
@permission_classes([IsAdminUser])
def complete_token_view(request, token_id):
    token = get_object_or_404(
        Token,
        id=token_id,
    )

    if token.status != Token.Status.SERVING:
        return JsonResponse(
            {"error": "Token is not currently serving"},
            status=409,
        )

    token.status = Token.Status.DONE
    token.finished_at = timezone.now()

    token.save(
        update_fields=[
            "status",
            "finished_at",
        ]
    )

    broadcast_queue_update(
        token.queue_id,
        {
            "event": "token_completed",
            "token_id": token.id,
            "number": token.number,
            "status": token.status,
        },
    )

    return JsonResponse(
        {
            "message": "Token completed successfully",
            "token_id": token.id,
            "number": token.number,
            "status": token.status,
        }
    )


# -----------------------------------
# Staff: Skip a token
# Requires authenticated staff user
# -----------------------------------

@api_view(["POST"])
@permission_classes([IsAdminUser])
def skip_token_view(request, token_id):
    token = get_object_or_404(
        Token,
        id=token_id,
    )

    allowed_statuses = [
        Token.Status.WAITING,
        Token.Status.SERVING,
    ]

    if token.status not in allowed_statuses:
        return JsonResponse(
            {"error": "Token cannot be skipped"},
            status=409,
        )

    token.status = Token.Status.SKIPPED
    token.finished_at = timezone.now()

    token.save(
        update_fields=[
            "status",
            "finished_at",
        ]
    )

    broadcast_queue_update(
        token.queue_id,
        {
            "event": "token_skipped",
            "token_id": token.id,
            "number": token.number,
            "status": token.status,
        },
    )

    return JsonResponse(
        {
            "message": "Token skipped successfully",
            "token_id": token.id,
            "number": token.number,
            "status": token.status,
        }
    )