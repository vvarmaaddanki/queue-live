from django.urls import path
from . import views

urlpatterns = [
    path(
        "generate/",
        views.create_token_view,
        name="create_token",
    ),

    path(
        "queues/<int:queue_id>/call-next/",
        views.call_next_view,
        name="call_next",
    ),

    path(
        "queues/<int:queue_id>/",
        views.queue_tokens_view,
        name="queue_tokens",
    ),

    path(
        "<int:token_id>/status/",
        views.token_status_view,
        name="token_status",
    ),

    path(
        "<int:token_id>/complete/",
        views.complete_token_view,
        name="complete_token",
    ),

    path(
        "<int:token_id>/skip/",
        views.skip_token_view,
        name="skip_token",
    ),
]
