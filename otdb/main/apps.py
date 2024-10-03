from django.apps import AppConfig
from django.conf import settings
from django.db import connection
from django.db.models.signals import post_migrate

import os
from hashlib import sha256
import logging
import sys


SQL_DIR = os.path.join(os.path.split(settings.BASE_DIR)[0], "sql")

log = logging.Logger(__name__)


def migrate_sql(sender, **kwargs):
    from .models import SQLFuncMigration

    stdout = kwargs.get('stdout', sys.stdout)

    migrations = tuple(SQLFuncMigration.objects.all())

    updates = []

    def update(file):
        with open(os.path.join(SQL_DIR, file), "rb") as f:
            contents = f.read()

        h = sha256(contents, usedforsecurity=False).hexdigest()

        for migration in migrations:
            if migration.filename == file:
                if migration.last_state != h:
                    # saved later if sql runs successfully
                    updates.append((contents, migration))
                    migration.last_state = h
                    stdout.write(f"Updating {file}\n")
                return

        updates.append((contents, SQLFuncMigration(filename=file, last_state=h)))
        stdout.write(f"Adding {file}\n")

    for file in os.listdir(SQL_DIR):
        update(file)

    for update, migration in updates:
        try:
            with connection.cursor() as cursor:
                cursor.execute(update)

            migration.save()
            print(f"{migration.filename} successfully updated")
        except Exception as e:
            stdout.write(f"Failed to migrate {migration.filename}: {e}\n")



class MainConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "main"

    def ready(self):
        post_migrate.connect(migrate_sql, sender=self)
