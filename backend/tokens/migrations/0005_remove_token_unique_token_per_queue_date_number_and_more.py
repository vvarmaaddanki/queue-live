from django.db import migrations, models


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
        migrations.AddConstraint(
            model_name="token",
            constraint=models.UniqueConstraint(
                fields=("queue", "service_date", "number"),
                name="unique_token_per_queue_date_number",
            ),
        ),
    ]