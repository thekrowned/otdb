from django.core.management.base import BaseCommand

import uvicorn


class Command(BaseCommand):
    help = "Runs the server with uvicorn"

    def handle(self, *args, **options):
        uvicorn.run(
            "otdb.asgi:application",
            reload=True,
            reload_dirs=[
                "api",
                "common",
                "database",
                "main",
                "otdb",
                "admin"
            ],
            log_level="debug"
        )
