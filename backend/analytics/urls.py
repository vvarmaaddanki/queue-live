from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health_check, name="health_check"),
    path("queues/", views.queue_list, name="queue_list"),
    path("queues/public/<uuid:public_id>/qr/", views.public_queue_qr, name="public_queue_qr"),
    path("queues/create/", views.create_queue, name="create_queue"),
    path("auth/register/", views.owner_register, name="owner_register"),
    path("queues/<uuid:queue_id>/status/", views.set_queue_status, name="set_queue_status"),
]
