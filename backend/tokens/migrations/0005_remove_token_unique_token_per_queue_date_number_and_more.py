
import django.db.models.deletion
from django.db import migrations, models


def copy_old_queue_ids(apps, schema_editor):
    Token = apps.get_model("tokens", "Token")
    Queue = apps.get_model("places", "Queue")

    db = schema_editor.connection.alias

    old_tokens = Token.objects.using(db).filter(
        legacy_queue_id__isnull=False
    )

    for token in old_tokens.iterator():
        old_queue_id = token.legacy_queue_id

        # Ensure the old queue ID still exists.
        if not Queue.objects.using(db).filter(
            pk=old_queue_id
        ).exists():
            raise RuntimeError(
                f"Queue ID {old_queue_id} does not exist. "
                "Cannot safely migrate this token."
            )

        # Copy the old integer ID into the new ForeignKey.
        Token.objects.using(db).filter(
            pk=token.pk
        ).update(queue_id=old_queue_id)


class Migration(migrations.Migration):

    dependencies = [
        (
            "places",
            "0003_rename_is_active_queue_is_open_remove_place_address_and_more",
        ),
        (
            "tokens",
            "0004_alter_token_queue_id",
        ),
    ]

    operations = [

        # Remove the old uniqueness constraint.
        migrations.RemoveConstraint(
            model_name="token",
            name="unique_token_per_queue_date_number",
        ),

        # Rename the old integer field first.
        migrations.RenameField(
            model_name="token",
            old_name="queue_id",
            new_name="legacy_queue_id",
        ),

        # Add the new ForeignKey.
        migrations.AddField(
            model_name="token",
            name="queue",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tokens",
                to="places.queue",
            ),
        ),

        # Preserve the old queue IDs.
        migrations.RunPython(
            copy_old_queue_ids,
            migrations.RunPython.noop,
        ),

        migrations.AddField(
            model_name="token",
            name="finished_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
            ),
        ),

        migrations.AddField(
            model_name="token",
            name="started_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
            ),
        ),

        migrations.AddField(
            model_name="token",
            name="status",
            field=models.CharField(
                choices=[
                    ("waiting", "Waiting"),
                    ("serving", "Serving"),
                    ("done", "Done"),
                    ("skipped", "Skipped"),
                    ("cancelled", "Cancelled"),
                ],
                default="waiting",
                max_length=10,
            ),
        ),

        # Add the new uniqueness constraint.
        migrations.AddConstraint(
            model_name="token",
            constraint=models.UniqueConstraint(
                fields=("queue", "service_date", "number"),
                name="unique_token_per_queue_date_number",
            ),
        ),

        # Remove the old integer field only after copying its data.
        migrations.RemoveField(
            model_name="token",
            name="legacy_queue_id",
        ),
    ]
