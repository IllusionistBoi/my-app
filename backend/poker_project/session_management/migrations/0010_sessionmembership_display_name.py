from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("session_management", "0009_production_readiness"),
    ]

    operations = [
        migrations.AddField(
            model_name="sessionmembership",
            name="display_name",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
    ]
