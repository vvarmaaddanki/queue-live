from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path(
        "ws/queues/<int:queue_id>/",
        consumers.QueueConsumer.as_asgi(),
    ),
]