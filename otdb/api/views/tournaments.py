from django.http import Http404
from django.contrib.postgres.search import SearchVector, SearchQuery

from ..serializers import *
from .util import *
from common.validation import *
from .mappools import get_mappools_with_favorites

import time


__all__ = (
    "get_full_tournament",
    
    "tournaments",
    "favorite_tournament",
    "search_tournaments"
)

TOURNAMENTS_PER_PAGE = 20


def _get_tournaments_with_favorites(page: int, order_by, where: str | None = None) -> list[Tournament]:
    offset = TOURNAMENTS_PER_PAGE * (page - 1)
    limit = TOURNAMENTS_PER_PAGE
    with connection.cursor() as cursor:
        if where is None:
            cursor.execute(f"""
                SELECT id, name, submitted_by_id,
                CASE WHEN favorites.cnt IS NULL THEN 0 ELSE favorites.cnt END AS favorite_cnt
                FROM database_tournament
                LEFT JOIN (
                    SELECT tournament_id, COUNT(*) AS cnt FROM database_tournamentfavorite
                    GROUP BY tournament_id
                ) favorites ON (favorites.tournament_id = database_tournament.id)
                ORDER BY {order_by} DESC
                LIMIT {limit} OFFSET {offset}
            """)
        else:
            cursor.execute(f"""
                SELECT id, name, submitted_by_id,
                CASE WHEN all_favorites IS NULL THEN 0 ELSE all_favorites.cnt END AS all_favorites_cnt,
                CASE WHEN favorites.cnt IS NULL THEN 0 ELSE favorites.cnt END AS favorite_cnt
                FROM database_tournament
                LEFT JOIN (
                    SELECT tournament_id, COUNT(*) AS cnt FROM database_tournamentfavorite
                    {'' if where is None else 'WHERE ' + where}
                    GROUP BY tournament_id
                ) favorites ON (favorites.tournament_id = database_tournament.id)
                LEFT JOIN (
                    SELECT tournament_id, COUNT(*) AS cnt FROM database_tournamentfavorite
                    GROUP BY tournament_id
                ) all_favorites ON (all_favorites.tournament_id = database_tournament.id)
                ORDER BY {order_by} DESC
                LIMIT {limit} OFFSET {offset}
            """)
        data = cursor.fetchall()

    tournament_list = []
    for tournament in data:
        obj = Tournament(id=tournament[0], name=tournament[1], submitted_by_id=tournament[2])
        obj.favorite_count = tournament[3]
        tournament_list.append(obj)

    return tournament_list


async def get_tournaments_with_favorites(page: int, order_by, where: str | None = None) -> list[Tournament]:
    return await sync_to_async(_get_tournaments_with_favorites)(page, order_by, where)


async def get_recent_tournaments(page) -> list[Tournament]:
    return await get_tournaments_with_favorites(page, "id")


async def get_favorite_tournaments(page) -> list[Tournament]:
    return await get_tournaments_with_favorites(page, "favorite_cnt")


async def get_trending_tournaments(page) -> list[Tournament]:
    week_ago = time.time() // 1 - 604800
    return await get_tournaments_with_favorites(page, "all_favorites_cnt", f"timestamp > {week_ago}")


async def get_full_tournament(user, id):
    try:
        tournament = await Tournament.objects\
            .prefetch_related("involvements__user", "mappools", "mappool_connections")\
            .select_related("submitted_by")\
            .aget(id=id)
    except Tournament.DoesNotExist:
        return
    
    data = TournamentSerializer(tournament).serialize(
        include=["involvements__user", "mappools", "submitted_by", "mappool_connections"],
        exclude=["mappool_connections__tournament_id"]
    )

    mappools = await get_mappools_with_favorites(
        1,
        "id",
        "id in (%s)" % ','.join((str(conn["mappool_id"]) for conn in data["mappool_connections"]))
    )
    for mappool in MappoolSerializer(mappools, many=True).serialize(include=["favorite_count"]):
        for conn in data["mappool_connections"]:
            if conn["mappool_id"] == mappool["id"]:
                conn["mappool"] = mappool
                break
    
    if user.is_authenticated:
        data["is_favorited"] = await tournament.is_favorited(user.id)
    
    return data


@require_method("GET", "POST", "DELETE")
async def tournaments(req, id=None):
    if req.method == "POST":
        return await create_tournament(req)
    elif req.method == "DELETE":
        if id is None:
            raise Http404()
        return await delete_tournament(req, id)
    
    if id is not None:
        user = await req.auser()
        tournament = await get_full_tournament(user, id)
        return JsonResponse(tournament, safe=False) if tournament is not None else \
            error("invalid tournament id", 404)
    
    sort_options = {
        "recent": get_recent_tournaments,
        "favorites": get_favorite_tournaments,
        "trending": get_trending_tournaments
    }
    sort = option_query_param(tuple(sort_options.keys()), "recent")(req.GET.get("s", "recent").lower())
    page = int_query_param(range(1, 9999999), 1)(req.GET.get("p", 1))

    tournament_list = await sort_options[sort](page)
    total = await Mappool.objects.acount()
    serializer = TournamentSerializer(tournament_list, many=True)
    return JsonResponse({
        "data": serializer.serialize(include=["favorite_count"]),
        "total_pages": (total - 1) // 20 + 1
    }, safe=False)


@requires_auth
@accepts_json_data(
    DictionaryType({
        "name": StringType(range(1, 129)),
        "abbreviation": StringType(range(0, 17), optional=True),
        "link": StringType(range(0, 257), optional=True),
        "description": StringType(range(0, 513), optional=True),
        "staff": ListType(
            DictionaryType({
                "id": IntegerType(minimum=0),
                "roles": FlagType(UserRoles)
            }),
            max_len=200,
            unique=True,
            unique_check=lambda a, b: a["id"] != b["id"]
        ),
        "mappools": ListType(
            DictionaryType({
                "id": IntegerType(minimum=0),
                "name_override": StringType(range(1, 65), optional=True)
            }),
            max_len=20
        )
    })
)
async def create_tournament(req, data):
    invalid_mappool_ids = []
    mappools = [mappool async for mappool in Mappool.objects.filter(id__in=[m["id"] for m in data["mappools"]])]
    for mappool in data["mappools"]:
        if not any((m.id == mappool["id"] for m in mappools)):
            invalid_mappool_ids.append(mappool["id"])

    if len(invalid_mappool_ids) > 0:
        return error("Invalid mappool ids: %s" % ", ".join(map(str, invalid_mappool_ids)), 400)

    user = await req.auser()
    tournament = await Tournament.new(
        data["name"],
        data["abbreviation"],
        data["description"],
        data["link"],
        user.id,
        data["staff"],
        data["mappools"],
        data.get("id") or 0
    )

    return JsonResponse(TournamentSerializer(tournament).serialize(), safe=False)


@requires_auth
async def delete_tournament(req, id):
    tournament = await Tournament.objects.filter(id=id).afirst()
    if tournament is None:
        return error("Invalid tournament id", 404)

    user = await req.auser()
    if tournament.submitted_by_id != user.id:
        return error("You cannot delete a tournament submitted by another user", 403)

    await tournament.adelete()

    return HttpResponse(b"", status=200)


@require_method("POST")
@requires_auth
@accepts_json_data(
    DictionaryType({"favorite": BoolType()})
)
async def favorite_tournament(req, tournament_id, data):
    try:
        tournament = await Tournament.objects.aget(id=tournament_id)
    except Mappool.DoesNotExist:
        return error("Invalid tournament id", 400)

    user = await req.auser()
    try:
        favorite = await TournamentFavorite.objects.aget(tournament_id=tournament.id, user_id=user.id)
    except TournamentFavorite.DoesNotExist:
        favorite = None

    if (favorite is not None and data["favorite"]) or (favorite is None and not data["favorite"]):
        return HttpResponse(b"", 200)

    if data["favorite"]:
        await TournamentFavorite.objects.acreate(tournament_id=tournament.id, user_id=user.id, timestamp=time.time()//1)
    else:
        await favorite.adelete()

    return HttpResponse(b"", 200)


@require_method("GET")
async def search_tournaments(req):
    def search(req):
        return list(Tournament.objects.annotate(
            search=SearchVector(
                "name",
                "abbreviation",
                "description"
            )
        ).filter(search=SearchQuery(req.GET.get("q", "test")))[:20])
    
    result = await sync_to_async(search)(req)
    return JsonResponse(TournamentSerializer(result, many=True).serialize(), safe=False)
