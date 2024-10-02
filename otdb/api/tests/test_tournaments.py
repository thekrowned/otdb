import pytest
import json

from .util import parse_resp, get_total_pages
from .. import views


@pytest.mark.django_db
class TestTournaments:
    @pytest.mark.asyncio
    @pytest.mark.dependency()
    async def test_create_tournament(self, client, sample_tournament):
        # create tournament
        req = await client.post("/api/tournaments/", data=json.dumps(sample_tournament))
        tournament = parse_resp(await views.tournaments(req))

        assert isinstance(tournament, dict), "expected a dict"
        self._test_tournament(sample_tournament, tournament, False)

        client.tournament = tournament

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestTournaments::test_create_tournament"])
    async def test_favorite_tournament(self, client):
        tournament = client.tournament

        req = await client.post(f"/api/tournament/{tournament['id']}/favorite/", data=json.dumps({"favorite": True}))
        parse_resp(await views.favorite_tournament(req, tournament["id"]))

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestTournaments::test_create_tournament"])
    async def test_get_tournament(self, client, sample_tournament):
        tournament = client.tournament

        req = await client.get(f"/api/tournaments/{tournament['id']}/")
        data = parse_resp(await views.tournaments(req, tournament['id']))

        self._test_tournament(data, tournament)
        assert data["favorite_count"] == 1, "test_favorite_tournament failed; no favorites on the tournament"
        for sample_staff in sample_tournament["staff"]:
            assert any((
                staff["roles"] == sample_staff["roles"] and
                staff["user"]["id"] == sample_staff["id"]
                for staff in data["staff"]
            )), "missing staff %d" % sample_staff["id"]

    async def _get_tournaments_listing(self, client, query: dict[str, str | int | None]):
        query_string = "&".join((f"{k}={'' if v is None else str(v)}" for k, v in query.items()))
        req = await client.get(f"/api/tournaments/?{query_string}")
        result = parse_resp(await views.tournaments(req))

        assert isinstance(result, dict)
        data = result["data"]
        assert isinstance(data, list)
        assert result["total_pages"] == get_total_pages(len(data))

        return data

    def _test_tournament(self, t1, t2, include_id=True):
        if include_id:
            assert t1["id"] == t2["id"], "tournament id does not match"
        assert t1["name"] == t2["name"], "tournament name does not match"
        assert t1["description"] == t2["description"], "tournament description does not match"
        assert t1["link"] == t2["link"], "tournament link does not match"
        assert t1["abbreviation"] == t2["abbreviation"], "tournament abbreviation does not match"

    def _test_tournament_listing(self, client, tournaments):
        assert isinstance(tournaments, list), "expected a list"
        assert len(tournaments) == 1, "expected one tournament item"
        self._test_tournament(tournaments[0], client.tournament)

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestTournaments::test_create_tournament"])
    async def test_recent_list(self, client):
        self._test_tournament_listing(
            client,
            await self._get_tournaments_listing(client, {"s": "recent"})
        )

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestTournaments::test_create_tournament"])
    async def test_favorite_list(self, client):
        self._test_tournament_listing(
            client,
            await self._get_tournaments_listing(client, {"s": "favorites"})
        )

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestTournaments::test_create_tournament"])
    async def test_trending_list(self, client):
        self._test_tournament_listing(
            client,
            await self._get_tournaments_listing(client, {"s": "trending"})
        )

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["TestTournaments::test_create_tournament"])
    async def test_tournament_search(self, client):
        for word in client.tournament["name"].split():
            mappools = await self._get_tournaments_listing(client, {
                "s": "recent",
                "q": word
            })
            self._test_tournament_listing(client, mappools)

            mappools = await self._get_tournaments_listing(client, {
                "s": "recent",
                "q": word + " wysi"
            })

            assert isinstance(mappools, list), "expected a list"
            assert len(mappools) == 0, "expected empty return"
