import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tokens", "0003_alter_token_options_and_more"),
    ]

    operations = [
        migrations.AlterField(
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
    ]