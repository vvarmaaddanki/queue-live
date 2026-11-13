from django.core.exceptions import ObjectDoesNotExist
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from places.models import Queue
from tokens.views import broadcast_queue_update, user_can_manage_queue


def health_check(request):
    return JsonResponse({
        "status": "success",
        "message": "Queue Live backend is running",
    })


@api_view(["GET"])\n@permission_classes([AllowAny])\ndef queue_list(request):
    if request.user.is_authenticated:
        if request.user.is_superuser:
            queues = Queue.objects.select_related("place").all()
        else:
            try:
                place_id = request.user.staff_profile.place_id
            except ObjectDoesNotExist:
                queues = Queue.objects.none()
            else:
                queues = Queue.objects.filter(place_id=place_id).select_related("place")
    else:
        queues = Queue.objects.filter(is_open=True).select_related("place")

    data = [
        {
            "id": str(queue.id),
            "public_id": str(queue.public_id),
            "name": queue.name,
            "place": queue.place.name,
            "is_open": queue.is_open,
            "default_minutes": queue.default_minutes,
        }
        for queue in queues.order_by("name")
    ]
    return JsonResponse({"queues": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_queue_status(request, queue_id):
    queue = Queue.objects.select_related("place").filter(id=queue_id).first()
    if queue is None:
        return JsonResponse({"error": "Queue not found"}, status=404)
    if not user_can_manage_queue(request.user, queue):
        return JsonResponse({"error": "You do not have access to this queue"}, status=403)

    is_open = request.data.get("is_open")
    if not isinstance(is_open, bool):
        return JsonResponse({"error": "is_open must be true or false"}, status=400)
    if queue.is_open == is_open:
        return JsonResponse({
            "message": "Queue status is already up to date",
            "is_open": queue.is_open,
        })

    queue.is_open = is_open
    queue.save(update_fields=["is_open"])
    broadcast_queue_update(queue.id, {
        "event": "queue_status_changed",
        "is_open": queue.is_open,
    })
    return JsonResponse({
        "message": "Queue opened successfully" if is_open else "Queue closed successfully",
        "is_open": queue.is_open,
    })
