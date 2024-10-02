import json
import pytest

from .util import parse_resp, get_total_pages
from .. import views


@pytest.mark.django_db
class TestMappools:
    @pytest.mark.asyncio
    @pytest.mark.dependency()
    async def test_create_mappool(self, client, sample_mappool):
        req = await client.post("/api/mappools/", data=json.dumps(sample_mappool))
        mappool = parse_resp(await views.mappools(req))

        assert isinstance(mappool, dict)
        assert isinstance(mappool["id"], int)

        self._test_mappool(mappool, sample_mappool, False)

        client.mappool = mappool

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestMappools::test_create_mappool"])
    async def test_favorite_mappool(self, client):
        mappool = client.mappool

        req = await client.post(f"/api/mappools/{mappool['id']}/favorite/", data=json.dumps({"favorite": True}))
        parse_resp(await views.favorite_mappool(req, mappool["id"]))

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestMappools::test_create_mappool"])
    async def test_get_mappool(self, client, sample_mappool):
        mappool = client.mappool

        req = await client.get(f"/api/mappools/{mappool['id']}/")
        data = parse_resp(await views.mappools(req, mappool['id']))

        self._test_mappool(data, mappool)
        assert data["favorite_count"] == 1, "test_favorite_mappool failed; no favorites on the mappool"
        for sample_beatmap in sample_mappool["beatmaps"]:
            beatmap_conn = next(filter(
                lambda c: c["beatmap"]["beatmap_metadata"]["id"] == sample_beatmap["id"],
                data["beatmap_connections"]
            ))

            assert sample_beatmap["slot"] == beatmap_conn["slot"]

            mods = [mod["acronym"] for mod in beatmap_conn["beatmap"]["mods"]]
            for mod in sample_beatmap["mods"]:
                assert mod in mods

    async def _get_mappools_listing(self, client, query: dict[str, str | int | None]):
        query_string = "&".join((f"{k}={'' if v is None else str(v)}" for k, v in query.items()))
        req = await client.get(f"/api/mappools/?{query_string}")
        result = parse_resp(await views.mappools(req))

        assert isinstance(result, dict)
        data = result["data"]
        assert isinstance(data, list)
        assert result["total_pages"] == get_total_pages(len(data))

        return data

    def _test_mappool(self, m1, m2, include_id=True):
        if include_id:
            assert m1["id"] == m2["id"], "mappool id does not match"
        assert m1["name"] == m2["name"], "mappool name does not match"
        assert m1["description"] == m2["description"], "mappool description does not match"

    def _test_mappool_listing(self, client, mappools):
        assert isinstance(mappools, list), "expected a list"
        assert len(mappools) == 1, "expected one mappool"
        self._test_mappool(mappools[0], client.mappool)

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestMappools::test_create_mappool"])
    async def test_recent_list(self, client):
        self._test_mappool_listing(
            client,
            await self._get_mappools_listing(client, {"s": "recent"})
        )

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestMappools::test_create_mappool"])
    async def test_favorite_list(self, client):
        self._test_mappool_listing(
            client,
            await self._get_mappools_listing(client, {"s": "favorites"})
        )

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestMappools::test_create_mappool"])
    async def test_trending_list(self, client):
        self._test_mappool_listing(
            client,
            await self._get_mappools_listing(client, {"s": "trending"})
        )

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestMappools::test_create_mappool"])
    async def test_sr_filter(self, client):
        mappools = await self._get_mappools_listing(client, {
            "s": "recent",
            "min-sr": 4,
            "max-sr": 6
        })
        self._test_mappool_listing(client, mappools)

        mappools = await self._get_mappools_listing(client, {
            "s": "recent",
            "min-sr": 6,
            "max-sr": 8
        })

        assert isinstance(mappools, list), "expected a list"
        assert len(mappools) == 0, "expected empty return"

        mappools = await self._get_mappools_listing(client, {
            "s": "recent",
            "min-sr": 6,
            "max-sr": 4
        })

        assert isinstance(mappools, list), "expected a list"
        assert len(mappools) == 0, "expected empty return"

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestMappools::test_create_mappool"])
    async def test_mappool_search(self, client):
        for word in client.mappool["name"].split():
            mappools = await self._get_mappools_listing(client, {
                "s": "recent",
                "q": word
            })
            self._test_mappool_listing(client, mappools)

            mappools = await self._get_mappools_listing(client, {
                "s": "recent",
                "q": word + " wysi"
            })

            assert isinstance(mappools, list), "expected a list"
            assert len(mappools) == 0, "expected empty return"
