from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
import json


@csrf_exempt
@require_POST
def create_token(request):
    try:
        data = json.loads(request.body)

        return JsonResponse({
            "message": "POST API is working",
            "received_data": data
        })

    except json.JSONDecodeError:
        return JsonResponse({
            "error": "Invalid JSON"
        }, status=400)
