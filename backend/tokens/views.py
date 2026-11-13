import csv
import json
import uuid

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponse, JsonResponse
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from places.models import Queue
from .models import Token
from .services import create_token, call_next


def user_can_manage_queue(user, queue):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    try:
        profile = user.staff_profile
    except ObjectDoesNotExist:
        return False
    return profile.place_id == queue.place_id and profile.role in ("owner", "staff")


def broadcast_queue_update(queue_id, data):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"queue_{queue_id}",
        {"type": "queue_update", "data": data},
    )


@csrf_exempt
@require_GET
def health_check_view(request):
    return JsonResponse({"status": "ok"})


@csrf_exempt
@require_POST
def create_token_view(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if not isinstance(data, dict):
        return JsonResponse({"error": "Invalid request body"}, status=400)

    name = data.get("name")
    queue_id = data.get("queue_id")
    phone = data.get("phone", "")
    if not isinstance(name, str) or not name.strip():
        return JsonResponse({"error": "Name is required"}, status=400)
    name = name.strip()
    if len(name) > 100:
        return JsonResponse({"error": "Name must be 100 characters or fewer"}, status=400)
    if not isinstance(phone, str):
        return JsonResponse({"error": "Phone must be text"}, status=400)
    phone = phone.strip()
    if phone and (not phone.isdigit() or not 10 <= len(phone) <= 15):
        return JsonResponse({"error": "Enter a valid phone number (10–15 digits)"}, status=400)

    try:
        queue_uuid = uuid.UUID(str(queue_id))
        queue = Queue.objects.get(id=queue_uuid)
    except (ValueError, TypeError, Queue.DoesNotExist):
        return JsonResponse({"error": "A valid queue_id is required"}, status=400)

    if not queue.is_open:
        return JsonResponse({"error": "This queue is currently closed"}, status=409)

    try:
        token = create_token(queue_id=queue.id, name=name, phone=phone)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=409)
    except Exception:
        return JsonResponse({"error": "Unable to generate token"}, status=500)

    return JsonResponse({
        "message": "Token created successfully",
        "public_id": str(token.public_id),
        "name": token.name,
        "queue_id": str(token.queue_id),
        "service_date": str(token.service_date),
        "number": token.number,
        "status": token.status,
    }, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_queue_tokens_view(request, queue_id):
    queue = get_object_or_404(Queue, id=queue_id)
    if not user_can_manage_queue(request.user, queue):
        return JsonResponse({"error": "You do not have access to this queue"}, status=403)

    tokens = Token.objects.filter(
        queue=queue,
        service_date=timezone.localdate(),
    ).order_by("number")

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = (
        f'attachment; filename="queue-{queue.id}-{timezone.localdate()}.csv"'
    )
    response.write("\ufeff")
    writer = csv.writer(response)
    writer.writerow([
        "Token Number",
        "Customer Name",
        "Mobile Number",
        "Status",
        "Created At",
        "Started At",
        "Finished At",
    ])
    for token in tokens:
        writer.writerow([
            token.number,
            token.name,
            token.phone,
            token.status,
            token.created_at.isoformat() if token.created_at else "",
            token.started_at.isoformat() if token.started_at else "",
            token.finished_at.isoformat() if token.finished_at else "",
        ])
    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def call_next_view(request, queue_id):
    queue = get_object_or_404(Queue, id=queue_id)
    if not user_can_manage_queue(request.user, queue):
        return JsonResponse({"error": "You do not have access to this queue"}, status=403)

    token = call_next(queue.id)
    broadcast_queue_update(queue.id, {
        "event": "queue_advanced",
        "token_id": token.id if token else None,
        "number": token.number if token else None,
        "status": token.status if token else "empty",
    })
    if token is None:
        return JsonResponse({"message": "No waiting customers"}, status=200)

    return JsonResponse({
        "message": "Next customer called",
        "token_id": token.id,
        "name": token.name,
        "queue_id": str(token.queue_id),
        "number": token.number,
        "status": token.status,
        "started_at": token.started_at.isoformat() if token.started_at else None,
    })


@require_GET
def token_status_view(request, public_id):
    token = get_object_or_404(Token, public_id=public_id)
    customers_ahead = 0
    if token.status == Token.Status.WAITING:
        customers_ahead = Token.objects.filter(
            queue_id=token.queue_id,
            service_date=token.service_date,
            status=Token.Status.WAITING,
            number__lt=token.number,
        ).count()

    average_minutes = token.queue.average_minutes() if token.queue else 10
    return JsonResponse({
        "name": token.name,
        "queue_id": str(token.queue_id) if token.queue_id else None,
        "token_number": token.number,
        "service_date": str(token.service_date),
        "status": token.status,
        "customers_ahead": customers_ahead,
        "estimated_wait_minutes": customers_ahead * average_minutes if token.status == Token.Status.WAITING else 0,
        "started_at": token.started_at.isoformat() if token.started_at else None,
        "finished_at": token.finished_at.isoformat() if token.finished_at else None,
    })


@csrf_exempt
@require_POST
@transaction.atomic
def cancel_token_view(request, public_id):
    token = get_object_or_404(Token.objects.select_for_update(), public_id=public_id)
    if token.status != Token.Status.WAITING:
        return JsonResponse({"error": "Only waiting tokens can be cancelled"}, status=409)

    token.status = Token.Status.CANCELLED
    token.finished_at = timezone.now()
    token.save(update_fields=["status", "finished_at"])
    if token.queue_id:
        broadcast_queue_update(token.queue_id, {
            "event": "token_cancelled",
            "token_id": token.id,
            "number": token.number,
            "status": token.status,
        })
    return JsonResponse({"message": "Token cancelled", "status": token.status})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def queue_tokens_view(request, queue_id):
    queue = get_object_or_404(Queue, id=queue_id)
    if not user_can_manage_queue(request.user, queue):
        return JsonResponse({"error": "You do not have access to this queue"}, status=403)
    tokens = Token.objects.filter(
        queue=queue,
        service_date=timezone.localdate(),
    ).order_by("number")
    return JsonResponse({
        "queue_id": str(queue.id),
        "queue_name": queue.name,
        "tokens": [{
            "token_id": token.id,
            "name": token.name,
            "number": token.number,
            "status": token.status,
            "started_at": token.started_at.isoformat() if token.started_at else None,
            "finished_at": token.finished_at.isoformat() if token.finished_at else None,
        } for token in tokens],
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def complete_token_view(request, token_id):
    token = get_object_or_404(Token.objects.select_for_update(), id=token_id)
    if not token.queue or not user_can_manage_queue(request.user, token.queue):
        return JsonResponse({"error": "You do not have access to this token"}, status=403)
    if token.status != Token.Status.SERVING:
        return JsonResponse({"error": "Token is not currently serving"}, status=409)
    token.status = Token.Status.DONE
    token.finished_at = timezone.now()
    token.save(update_fields=["status", "finished_at"])
    broadcast_queue_update(token.queue_id, {"event": "token_completed", "token_id": token.id, "number": token.number, "status": token.status})
    return JsonResponse({"message": "Token completed successfully", "token_id": token.id, "number": token.number, "status": token.status})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def skip_token_view(request, token_id):
    token = get_object_or_404(Token.objects.select_related("queue").select_for_update(), id=token_id)
    if not token.queue or not user_can_manage_queue(request.user, token.queue):
        return JsonResponse({"error": "You do not have access to this token"}, status=403)
    if token.status not in [Token.Status.WAITING, Token.Status.SERVING]:
        return JsonResponse({"error": "Token cannot be skipped"}, status=409)
    token.status = Token.Status.SKIPPED
    token.finished_at = timezone.now()
    token.save(update_fields=["status", "finished_at"])
    broadcast_queue_update(token.queue_id, {"event": "token_skipped", "token_id": token.id, "number": token.number, "status": token.status})
    return JsonResponse({"message": "Token skipped successfully", "token_id": token.id, "number": token.number, "status": token.status})
