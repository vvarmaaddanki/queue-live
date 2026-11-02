import uuid
from django.db import models


class Token(models.Model):
    class Status(models.TextChoices):
        WAITING = "waiting", "Waiting"
        SERVING = "serving", "Serving"
        DONE = "done", "Done"
        SKIPPED = "skipped", "Skipped"
        CANCELLED = "cancelled", "Cancelled"

    public_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )
    queue = models.ForeignKey(
        "places.Queue",
        on_delete=models.CASCADE,
        related_name="tokens",
    )
    service_date = models.DateField()
    number = models.PositiveIntegerField()
    customer_name = models.CharField(max_length=80)
    phone = models.CharField(max_length=15, blank=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.WAITING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["queue", "service_date", "number"],
                name="unique_number_per_queue_day",
            )
        ]
        indexes = [
            models.Index(
                fields=["queue", "service_date", "status"]
            )
        ]

    def _str_(self):
        return f"Token {self.number} - {self.customer_name}"