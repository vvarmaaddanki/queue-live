from django.db import models
from places.models import Queue


class Token(models.Model):
    class Status(models.TextChoices):
        WAITING = "waiting", "Waiting"
        SERVING = "serving", "Serving"
        DONE = "done", "Done"
        SKIPPED = "skipped", "Skipped"
        CANCELLED = "cancelled", "Cancelled"

    name = models.CharField(max_length=100)

    queue = models.ForeignKey(
        Queue,
        on_delete=models.CASCADE,
        related_name="tokens",
        null=True,
        blank=True,
    )
    service_date = models.DateField()
    number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.WAITING,
    )
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["queue", "service_date", "status"],
                name="tokens_toke_queue_i_53e2a9_idx",
            )
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["queue", "service_date", "number"],
                name="unique_token_per_queue_date_number",
            )
        ]
        ordering = ["number"]

    def __str__(self):
        return f"{self.name} - Queue {self.queue_id} - Token {self.number}"
