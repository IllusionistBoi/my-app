from django.core.management import call_command
from django.db import migrations


def create_cache_table(apps, schema_editor):
    """Create the database cache table used by DRF throttling.

    Reads the table name from settings.CACHES; createcachetable is idempotent, so this is safe
    on both a fresh database and an already-provisioned one.
    """
    call_command(
        "createcachetable",
        database=schema_editor.connection.alias,
        verbosity=0,
    )


def drop_cache_table(apps, schema_editor):
    schema_editor.execute("DROP TABLE IF EXISTS poker_cache_table")


class Migration(migrations.Migration):
    dependencies = [
        ("session_management", "0010_sessionmembership_display_name"),
    ]

    operations = [
        migrations.RunPython(create_cache_table, drop_cache_table),
    ]
