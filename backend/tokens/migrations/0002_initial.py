from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("places", "0002_initial"), ("tokens", "0001_initial")]

    operations = [
        migrations.RenameField(
            model_name="token",
            old_name="customer_name",
            new_name="name",
        ),
        migrations.AlterField(
            model_name="token",
            name="name",
            field=models.CharField(max_length=100),
        ),
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
        migrations.RemoveConstraint(
            model_name="token",
            name="unique_number_per_queue_day",
        ),
        migrations.AddConstraint(
            model_name="token",
            constraint=models.UniqueConstraint(
                fields=("queue", "service_date", "number"),
                name="unique_token_per_queue_date_number",
            ),
        ),
    ]
