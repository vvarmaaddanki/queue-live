from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="queue",
            name="public_id",
            field=models.UUIDField(
                default=uuid.uuid4,
                unique=True,
                editable=False,
            ),
        ),
    ]
