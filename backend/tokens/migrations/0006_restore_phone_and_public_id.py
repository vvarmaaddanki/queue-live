import uuid

from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    Token = apps.get_model("tokens", "Token")
    database = schema_editor.connection.alias
    for token in Token.objects.using(database).filter(public_id__isnull=True).iterator():
        Token.objects.using(database).filter(pk=token.pk).update(public_id=uuid.uuid4())


class Migration(migrations.Migration):

    dependencies = [
        ("tokens", "0005_remove_token_unique_token_per_queue_date_number_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="token",
            name="phone",
            field=models.CharField(blank=True, default="", max_length=15),
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
