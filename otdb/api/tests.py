from django.test import RequestFactory
from django.contrib.auth import get_user_model
from django.db import connection
from django.conf import settings

from . import views

from asgiref.sync import sync_to_async
import json
import pytest


OsuUser = get_user_model()
SQL_DIR = settings.BASE_DIR / "sql"


class Client:
    def __init__(self):
        self.factory = RequestFactory()
        self.user = OsuUser.objects.get(id=14895608)
        self.mappool = None

    def get(self, *args, **kwargs):
        req = self.factory.get(*args, **kwargs)
        req.user = self.user
        return req

    def post(self, *args, content_type="application/json", **kwargs):
        req = self.factory.post(*args, content_type=content_type, **kwargs)
        req.user = self.user
        return req


@pytest.fixture(scope="session")
def django_db_keepdb():
    yield False


@pytest.fixture(scope="session")
def django_db_createdb():
    yield True


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock():
        user = OsuUser(
            id=14895608,
            username="Sheppsu",
            avatar="",
            cover=""
        )
        user.save()


@pytest.fixture
def mappool_request():
    yield {
        "name": "test mappool",
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


@pytest.fixture(scope="session")
def client(django_db_blocker):
    with django_db_blocker.unblock():
        yield Client()


@pytest.mark.django_db
class TestTournaments:
    def test_list(self, client):
        req = client.get("/api/tournaments/")
        resp = views.tournaments(req)
        assert resp.status_code == 200
        assert isinstance(json.loads(resp.content), list)


@pytest.mark.django_db
class TestMappools:
    @pytest.mark.asyncio
    async def test_create_mappool(self, client, mappool_request):
        def create_new_mappool_function():
            with open(SQL_DIR / "new_mappool.sql", "r") as f:
                with connection.cursor() as cursor:
                    cursor.execute(f.read())

        await sync_to_async(create_new_mappool_function)()

        req = client.post("/api/mappools/", data=json.dumps(mappool_request))
        resp = await views.mappools(req)

        assert resp.status_code == 200, resp.content.decode("utf-8")
        mappool = json.loads(resp.content)
        assert isinstance(mappool, dict)
        assert isinstance(mappool["id"], int)
        assert mappool["name"] == mappool_request["name"]

        client.mappool = mappool

    @pytest.mark.asyncio
    async def test_get_mappool(self, client, mappool_request):
        mappool = client.mappool
        assert mappool is not None, "test_create_mappool failed; no mappool"

        req = client.get(f"/api/mappools/{mappool['id']}/")
        resp = await views.mappools(req, mappool['id'])

        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert data["id"] == mappool["id"]
        assert data["name"] == mappool["name"]
        for test_beatmap in mappool_request["beatmaps"]:
            beatmap = next(filter(lambda b: b["beatmap_metadata"]["id"] == test_beatmap["id"], data["beatmaps"]))
            assert test_beatmap["slot"] == beatmap["slot"]
            mods = [mod["acronym"] for mod in beatmap["mods"]]
            for mod in test_beatmap["mods"]:
                assert mod in mods

    def test_favorite_mappool(self, client):
        mappool = client.mappool
        assert mappool is not None, "test_create_mappool failed; no mappool"

        req = client.post(f"/api/mappools/{mappool['id']}/favorite/", data=json.dumps({"favorite": True}))
        resp = views.favorite_mappool(req, mappool["id"])

        assert resp.status_code == 200

    async def _test_mappool_list(self, client, sort):
        mappool = client.mappool
        assert mappool is not None, "test_create_mappool failed; no mappool"

        req = client.get(f"/api/mappools/?s={sort}")
        resp = await views.mappools(req)

        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert isinstance(data, dict)
        assert data["total_pages"] == 1
        mappools = data["data"]
        assert isinstance(mappools, list)
        assert len(mappools) == 1
        assert mappools[0]["id"] == mappool["id"]
        assert mappools[0]["name"] == mappool["name"]
        assert mappools[0]["favorite_count"] == 1, "test_favorite_mappool failed; no favorites on the mappool"

    @pytest.mark.asyncio
    async def test_recent_list(self, client):
        await self._test_mappool_list(client, "recent")

    @pytest.mark.asyncio
    async def test_favorite_list(self, client):
        await self._test_mappool_list(client, "favorites")

    @pytest.mark.asyncio
    async def test_trending_list(self, client):
        await self._test_mappool_list(client, "trending")
