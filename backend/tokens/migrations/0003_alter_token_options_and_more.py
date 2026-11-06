from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tokens", "0002_token_name_alter_token_number_and_more"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="token",
            options={"ordering": ["number"]},
        ),

        migrations.RemoveConstraint(
            model_name="token",
            name="unique_number_per_queue_day",
        ),

        migrations.RemoveIndex(
            model_name="token",
            name="tokens_toke_queue_i_53e2a9_idx",
        ),

        migrations.AlterField(
            model_name="token",
            name="number",
            field=models.PositiveIntegerField(),
        ),

        migrations.AlterField(
            model_name="token",
            name="service_date",
            field=models.DateField(),
        ),

        migrations.RemoveField(
            model_name="token",
            name="customer_name",
        ),

        migrations.RemoveField(
            model_name="token",
            name="phone",
        ),

        migrations.RemoveField(
            model_name="token",
            name="public_id",
        ),
    ]