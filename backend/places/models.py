import uuid
from statistics import median
from django.conf import settings
from django.db import models


class Place(models.Model):
    class Kind(models.TextChoices):
        CLINIC = "clinic", "Clinic"
        SALON = "salon", "Salon"
        TUITION = "tuition", "Tuition centre"
        OTHER = "other", "Other"
    id = models.UUIDField(
    primary_key=True,
    default=uuid.uuid4,
    editable=False,
)

    name = models.CharField(max_length=120)
    kind = models.CharField(
        max_length=20,
        choices=Kind.choices,
        default=Kind.CLINIC,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class StaffProfile(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        STAFF = "staff", "Staff"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_profile",
    )
    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        related_name="staff",
    )
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.OWNER,
    )


class Queue(models.Model):
    public_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )
    id = models.UUIDField(
    primary_key=True,
    default=uuid.uuid4,
    editable=False,
)
    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        related_name="queues",
    )
    name = models.CharField(max_length=80)
    is_open = models.BooleanField(default=True)
    default_minutes = models.PositiveSmallIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def average_minutes(self):
        recent = self.tokens.filter(
            status="done",
            started_at__isnull=False,
            finished_at__isnull=False,
        ).order_by("-finished_at")[:10]

        minutes = [
            (t.finished_at - t.started_at).total_seconds() / 60
            for t in recent
        ]
        minutes = [m for m in minutes if 0.2 < m < 120]

        if len(minutes) < 3:
            return float(self.default_minutes)

        return round(median(minutes), 1)