import uuid

import django.db.models.deletion
from django.db import migrations, models


def populate_queue_public_ids(apps, schema_editor):
    Queue = apps.get_model("places", "Queue")
    for queue in Queue.objects.filter(public_id__isnull=True).iterator():
        queue.public_id = uuid.uuid4()
        queue.save(update_fields=["public_id"])


def copy_queue_open_state(apps, schema_editor):
    Queue = apps.get_model("places", "Queue")
    for queue in Queue.objects.all().iterator():
        queue.is_open = queue.is_active
        queue.save(update_fields=["is_open"])


class Migration(migrations.Migration):
    dependencies = [("places", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="place",
            name="kind",
            field=models.CharField(
                choices=[("clinic", "Clinic"), ("salon", "Salon"), ("tuition", "Tuition centre"), ("other", "Other")],
                default="clinic",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="staffprofile",
            name="role",
            field=models.CharField(
                choices=[("owner", "Owner"), ("staff", "Staff")],
                default="owner",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="queue",
            name="public_id",
            field=models.UUIDField(blank=True, null=True, editable=False),
        ),
        migrations.RunPython(populate_queue_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="queue",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AddField(
            model_name="queue",
            name="is_open",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="queue",
            name="default_minutes",
            field=models.PositiveSmallIntegerField(default=10),
        ),
        migrations.RunPython(copy_queue_open_state, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="staffprofile",
            name="place",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staff", to="places.place"),
        ),
    ]
