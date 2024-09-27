from django.test import RequestFactory
from django.contrib.auth import get_user_model
from django.db import connection
from django.conf import settings

from . import views

import json
import pytest
import os


OsuUser = get_user_model()
SQL_DIR = os.path.join(os.path.split(settings.BASE_DIR)[0], "sql")


def auser(user):
    async def get():
        return user

    return get


class Client:
    def __init__(self):
        self.factory = RequestFactory()
        self.user = OsuUser.objects.get(id=14895608)
        self.mappool = None

    def _fill_req(self, req):
        req.auser = auser(self.user)
        return req

    def get(self, *args, **kwargs):
        return self._fill_req(self.factory.get(*args, **kwargs))

    def post(self, *args, content_type="application/json", **kwargs):
        return self._fill_req(self.factory.post(*args, content_type=content_type, **kwargs))


@pytest.fixture(scope="session")
def django_db_keepdb():
    yield False


@pytest.fixture(scope="session")
def django_db_createdb():
    yield True


def create_user():
    user = OsuUser(
        id=14895608,
        username="Sheppsu",
        avatar="",
        cover=""
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
    yield {
        "name": "test mappool",
        "description": "this is a description",
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


def parse_resp(resp):
    assert resp.status_code == 200, resp.content.decode("utf-8")
    return json.loads(resp.content) if resp.content else None


@pytest.mark.django_db
class TestTournaments:
    @pytest.mark.asyncio
    async def test_tournaments_list(self, client):
        req = client.get("/api/tournaments/")
        parse_resp(await views.tournaments(req))


@pytest.mark.django_db
class TestMappools:
    @pytest.mark.asyncio
    async def test_create_mappool(self, client, sample_mappool):
        req = client.post("/api/mappools/", data=json.dumps(sample_mappool))
        mappool = parse_resp(await views.mappools(req))

        assert isinstance(mappool, dict)
        assert isinstance(mappool["id"], int)

        assert mappool["name"] == sample_mappool["name"]
        assert mappool["description"] == sample_mappool["description"]

        client.mappool = mappool

    @pytest.mark.asyncio
    async def test_get_mappool(self, client, sample_mappool):
        mappool = client.mappool
        assert mappool is not None, "test_create_mappool failed; no mappool"

        req = client.get(f"/api/mappools/{mappool['id']}/")
        data = parse_resp(await views.mappools(req, mappool['id']))

        assert data["id"] == mappool["id"]
        assert data["name"] == mappool["name"]
        assert data["description"] == mappool["description"]
        for sample_beatmap in sample_mappool["beatmaps"]:
            beatmap_conn = next(filter(
                lambda c: c["beatmap"]["beatmap_metadata"]["id"] == sample_beatmap["id"],
                data["beatmap_connections"]
            ))

            assert sample_beatmap["slot"] == beatmap_conn["slot"]

            mods = [mod["acronym"] for mod in beatmap_conn["beatmap"]["mods"]]
            for mod in sample_beatmap["mods"]:
                assert mod in mods

    @pytest.mark.asyncio
    async def test_favorite_mappool(self, client):
        mappool = client.mappool
        assert mappool is not None, "test_create_mappool failed; no mappool"

        req = client.post(f"/api/mappools/{mappool['id']}/favorite/", data=json.dumps({"favorite": True}))
        parse_resp(await views.favorite_mappool(req, mappool["id"]))

    async def _test_mappool_list(self, client, sort):
        mappool = client.mappool
        assert mappool is not None, "test_create_mappool failed; no mappool"

        req = client.get(f"/api/mappools/?s={sort}")
        data = parse_resp(await views.mappools(req))

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
