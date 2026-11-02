from django.http import JsonResponse
from places.models import Queue


def health_check(request):
    return JsonResponse({
        "status": "success",
        "message": "Queue Live backend is running"
    })


def queue_list(request):
    queues = Queue.objects.filter(is_open=True)

    data = [
    {
        "id": str(queue.id),
        "public_id": str(queue.public_id),
        "name": queue.name,
        "place": queue.place.name,
        "is_open": queue.is_open,
        "default_minutes": queue.default_minutes,
    }
    for queue in queues
]

    return JsonResponse({"queues": data})