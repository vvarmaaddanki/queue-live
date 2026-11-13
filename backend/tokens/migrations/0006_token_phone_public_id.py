import uuid

from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    Token = apps.get_model("tokens", "Token")
    for token in Token.objects.filter(public_id__isnull=True).iterator():
        token.public_id = uuid.uuid4()
        token.save(update_fields=["public_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("places", "0003_rename_is_active_queue_is_open_remove_place_address_and_more"),
        ("tokens", "0005_remove_token_unique_token_per_queue_date_number_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="token",
            name="phone",
            field=models.CharField(blank=True, max_length=15, default=""),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="token",
            name="public_id",
            field=models.UUIDField(blank=True, null=True, editable=False),
        ),
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="token",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
