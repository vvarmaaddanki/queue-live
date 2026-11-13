from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0003_rename_is_active_queue_is_open_remove_place_address_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="place",
            name="address",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="queue",
            name="location",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="queue",
            name="capacity",
            field=models.PositiveIntegerField(default=50),
        ),
        migrations.AddField(
            model_name="queue",
            name="current_people",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
