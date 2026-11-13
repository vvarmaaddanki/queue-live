from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health_check, name="health_check"),
    path("queues/", views.queue_list, name="queue_list"),
    path("queues/<uuid:queue_id>/status/", views.set_queue_status, name="set_queue_status"),
]
