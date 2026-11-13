from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.contrib.auth import get_user_model, password_validation
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from places.models import Place, Queue, StaffProfile
from tokens.views import broadcast_queue_update, user_can_manage_queue


def health_check(request):
    return JsonResponse({
        "status": "success",
        "message": "Queue Live backend is running",
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def queue_list(request):
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


@api_view(["POST"])
@permission_classes([AllowAny])
def owner_register(request):
    """Create a business, its first owner account, and staff profile atomically."""
    username = request.data.get("username")
    email = request.data.get("email", "")
    password = request.data.get("password")
    place_name = request.data.get("place_name")
    place_kind = request.data.get("place_kind", Place.Kind.OTHER)

    if not all(isinstance(value, str) for value in (username, email, password, place_name, place_kind)):
        return JsonResponse({"error": "All registration fields must be text"}, status=400)

    username = username.strip()
    email = email.strip().lower()
    place_name = place_name.strip()
    if not username or len(username) > 150:
        return JsonResponse({"error": "Enter a valid username (1–150 characters)"}, status=400)
    if not place_name or len(place_name) > 120:
        return JsonResponse({"error": "Business name is required (maximum 120 characters)"}, status=400)
    valid_kinds = {choice[0] for choice in Place.Kind.choices}
    if place_kind not in valid_kinds:
        return JsonResponse({"error": "Select a valid business type"}, status=400)
    if email and ("@" not in email or len(email) > 254):
        return JsonResponse({"error": "Enter a valid email address"}, status=400)

    User = get_user_model()
    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({"error": "This username is already taken"}, status=409)

    user = User(username=username, email=email)
    try:
        password_validation.validate_password(password, user=user)
    except ValidationError as exc:
        return JsonResponse({"error": " ".join(exc.messages)}, status=400)

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
            )
            place = Place.objects.create(name=place_name, kind=place_kind)
            StaffProfile.objects.create(
                user=user,
                place=place,
                role=StaffProfile.Role.OWNER,
            )
    except IntegrityError:
        return JsonResponse({"error": "Unable to create owner account. Username may already exist."}, status=409)

    return JsonResponse({
        "message": "Owner account created. You can now log in.",
        "username": user.username,
        "place_id": str(place.id),
        "role": StaffProfile.Role.OWNER,
    }, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_queue(request):
    try:
        profile = request.user.staff_profile
    except ObjectDoesNotExist:
        return JsonResponse({"error": "A business owner account is required"}, status=403)

    if profile.role != StaffProfile.Role.OWNER:
        return JsonResponse({"error": "Only the business owner can create queues"}, status=403)

    name = request.data.get("name")
    default_minutes = request.data.get("default_minutes", 10)
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
        return JsonResponse({"error": "Queue name is required (maximum 80 characters)"}, status=400)
    if isinstance(default_minutes, bool) or not isinstance(default_minutes, int) or not 1 <= default_minutes <= 120:
        return JsonResponse({"error": "Service time must be a whole number from 1 to 120 minutes"}, status=400)

    queue = Queue.objects.create(
        place=profile.place,
        name=name.strip(),
        default_minutes=default_minutes,
    )
    return JsonResponse({
        "message": "Queue created successfully",
        "id": str(queue.id),
        "public_id": str(queue.public_id),
        "name": queue.name,
        "place": profile.place.name,
        "is_open": queue.is_open,
        "default_minutes": queue.default_minutes,
    }, status=201)
