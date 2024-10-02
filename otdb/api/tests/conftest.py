from django.test import AsyncRequestFactory
from django.db import connection
from django.conf import settings

from asgiref.sync import sync_to_async
import os
import pytest

from main.models import OsuUser


SQL_DIR = os.path.join(os.path.split(settings.BASE_DIR)[0], "sql")


USER = {
    "id": 14895608,
    "username": "Sheppsu",
    "avatar": "https://a.ppy.sh/14895608?1718517008.jpeg",
    "cover": "https://assets.ppy.sh/user-profile-covers/14895608/859a7bda8ad09971013e5b7d1c619d1ca7b4cb0ee9caaaad8072a18973f3bad0.jpeg",
    "is_admin": True
}


def auser(user):
    async def get():
        return user

    return get


class Client:
    __slots__ = ("factory", "_user", "mappool", "tournament")

    def __init__(self):
        self.factory = AsyncRequestFactory()
        self._user = None

        self.mappool = None
        self.tournament = None

    def _get_user(self):
        return OsuUser.objects.get(id=USER["id"])

    async def get_user(self):
        if self._user is None:
            self._user = await sync_to_async(self._get_user)()

        return self._user

    async def _fill_req(self, req):
        req.auser = auser(await self.get_user())
        return req

    async def get(self, *args, **kwargs):
        return await self._fill_req(self.factory.get(*args, **kwargs))

    async def post(self, *args, content_type="application/json", **kwargs):
        return await self._fill_req(self.factory.post(*args, content_type=content_type, **kwargs))


@pytest.fixture(scope="session")
def django_db_keepdb():
    return settings.IS_GITHUB_WORKFLOW


@pytest.fixture(scope="session")
def django_db_createdb():
    return not settings.IS_GITHUB_WORKFLOW


def create_user():
    user = OsuUser(
        id=USER["id"],
        username=USER["username"],
        avatar=USER["avatar"],
        cover=USER["cover"]
    )
    user.save()


def create_psql_functions():
    with connection.cursor() as cursor:
        for file in os.listdir(SQL_DIR):
            with open(os.path.join(SQL_DIR, file), "r") as f:
                cursor.execute(f.read())


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock():
        create_user()
        create_psql_functions()


@pytest.fixture
def sample_mappool():
    return {
        "name": "test mappool",
        "description": "this is a mappool description",
        "beatmaps": [
            {
                "id": 3993830,
                "slot": "EZ1",
                "mods": ["EZ"]
            },
            {
                "id": 4021669,
                "slot": "EZ2",
                "mods": ["EZ"]
            },
            {
                "id": 2964073,
                "slot": "EZ3",
                "mods": ["EZ"]
            },
            {
                "id": 3316178,
                "slot": "EZ4",
                "mods": ["EZ"]
            },
            {
                "id": 4031511,
                "slot": "HD1",
                "mods": ["EZ", "HD"]
            },
            {
                "id": 2369018,
                "slot": "HD2",
                "mods": ["EZ", "HD"]
            },
            {
                "id": 4154290,
                "slot": "DT1",
                "mods": ["EZ", "DT"]
            },
            {
                "id": 49612,
                "slot": "DT2",
                "mods": ["EZ", "DT"]
            },
            {
                "id": 2478754,
                "slot": "HT1",
                "mods": ["EZ", "HT"]
            },
            {
                "id": 2447573,
                "slot": "HT2",
                "mods": ["EZ", "HT"]
            }
        ]
    }


@pytest.fixture
def sample_tournament():
    return {
        "name": "test tournament",
        "abbreviation": "TT",
        "link": "https://www.google.com",
        "description": "this is a tournament description",
        "staff": [
            {
                "id": 14895608,
                "roles": 3
            }
        ],
        "mappools": []
    }


@pytest.fixture
def sample_user():
    return USER


@pytest.fixture(scope="session")
def client():
    return Client()
