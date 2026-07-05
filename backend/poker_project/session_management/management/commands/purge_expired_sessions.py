from django.core.management.base import BaseCommand
from django.utils import timezone

from session_management.models import Session


class Command(BaseCommand):
    help = "Delete expired planning-poker sessions and their memberships."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report how many sessions would be deleted without changing data.",
        )

    def handle(self, *args, **options):
        expired = Session.objects.filter(expires_at__lte=timezone.now())
        count = expired.count()
        if not options["dry_run"]:
            expired.delete()
        action = "Would delete" if options["dry_run"] else "Deleted"
        self.stdout.write(self.style.SUCCESS(f"{action} {count} expired session(s)."))
