from django.contrib.postgres.search import SearchVector, SearchQuery

from ..serializers import *
from .util import *
from common.validation import *

import time


__all__ = (
    "get_full_mappool",
    
    "mappools",
    "favorite_mappool",
    "search_mappools"
)


VALID_MODS = ("EZ", "HD", "HR", "DT", "FM", "RX", "HT", "NC", "FL", "AP", "SO")
MAPPOOLS_PER_PAGE = 20


def _get_mappools_with_favorites(page: int, order_by, where: str | None = None) -> list[Mappool]:
    offset = MAPPOOLS_PER_PAGE * (page - 1)
    limit = MAPPOOLS_PER_PAGE
    with connection.cursor() as cursor:
        if where is None:
            cursor.execute(f"""
                SELECT id, name, submitted_by_id, avg_star_rating,
                CASE WHEN favorites.cnt IS NULL THEN 0 ELSE favorites.cnt END AS favorite_cnt
                FROM database_mappool
                LEFT JOIN (
                    SELECT mappool_id, COUNT(*) AS cnt FROM database_mappoolfavorite
                    GROUP BY mappool_id
                ) favorites ON (favorites.mappool_id = database_mappool.id)
                ORDER BY {order_by} DESC
                LIMIT {limit} OFFSET {offset}
            """)
        else:
            cursor.execute(f"""
                SELECT id, name, submitted_by_id, avg_star_rating,
                CASE WHEN all_favorites IS NULL THEN 0 ELSE all_favorites.cnt END AS all_favorites_cnt,
                CASE WHEN favorites.cnt IS NULL THEN 0 ELSE favorites.cnt END AS favorite_cnt
                FROM database_mappool
                LEFT JOIN (
                    SELECT mappool_id, COUNT(*) AS cnt FROM database_mappoolfavorite
                    {'' if where is None else 'WHERE ' + where}
                    GROUP BY mappool_id
                ) favorites ON (favorites.mappool_id = database_mappool.id)
                LEFT JOIN (
                    SELECT mappool_id, COUNT(*) AS cnt FROM database_mappoolfavorite
                    GROUP BY mappool_id
                ) all_favorites ON (all_favorites.mappool_id = database_mappool.id)
                ORDER BY {order_by} DESC
                LIMIT {limit} OFFSET {offset}
            """)
        data = cursor.fetchall()

    mappool_list = []
    for mappool in data:
        obj = Mappool(id=mappool[0], name=mappool[1], submitted_by_id=mappool[2], avg_star_rating=mappool[3])
        obj.favorite_count = mappool[4]
        mappool_list.append(obj)

    return mappool_list


async def get_mappools_with_favorites(page: int, order_by, where: str | None = None) -> list[Mappool]:
    return await sync_to_async(_get_mappools_with_favorites)(page, order_by, where)


async def get_recent_mappools(page) -> list[Mappool]:
    return await get_mappools_with_favorites(page, "id")


async def get_favorite_mappools(page) -> list[Mappool]:
    return await get_mappools_with_favorites(page, "favorite_cnt")


async def get_trending_mappools(page) -> list[Mappool]:
    week_ago = time.time() // 1 - 604800
    return await get_mappools_with_favorites(page, "all_favorites_cnt", f"timestamp > {week_ago}")


async def get_full_mappool(user, mappool_id) -> dict:
    include = (
        "submitted_by",
    )
    prefetch = (
        "beatmaps",
        "beatmaps__beatmapset_metadata",
        "beatmaps__beatmap_metadata",
        "beatmaps__mods"
    )

    try:
        mappool = await Mappool.objects.prefetch_related(*prefetch).select_related(*include).aget(id=mappool_id)
    except Mappool.DoesNotExist:
        return
    data = MappoolSerializer(mappool).serialize(include=include+prefetch)

    if user.is_authenticated:
        data["is_favorited"] = await mappool.is_favorited(user.id)

    return data


@require_method("GET", "POST", "DELETE")
async def mappools(req, mappool_id=None):
    if req.method == "POST":
        return await create_mappool(req)
    elif req.method == "DELETE":
        return await delete_mappool(req, mappool_id)

    if mappool_id is not None:
        user = await req.auser()
        mappool = await get_full_mappool(user, mappool_id)
        return JsonResponse(mappool, safe=False) if mappool is not None else \
            error("invalid mappool id", 404)

    sort_options = {
        "recent": get_recent_mappools,
        "favorites": get_favorite_mappools,
        "trending": get_trending_mappools
    }
    sort = option_query_param(tuple(sort_options.keys()), "recent")(req.GET.get("s", "recent").lower())
    page = int_query_param(range(1, 9999999), 1)(req.GET.get("p", 1))

    mappool_list = await sort_options[sort](page)
    total = await Mappool.objects.acount()
    serializer = MappoolSerializer(mappool_list, many=True)
    return JsonResponse(
        {
            "data": serializer.serialize(include=["favorite_count"]),
            "total_pages": (total - 1) // 20 + 1
        },
        safe=False
    )


@requires_auth
@accepts_json_data(
    DictionaryType({
        "id": IntegerType(minimum=0, optional=True),
        "name": StringType(range(1, 65)),
        "beatmaps": ListType(
            DictionaryType({
                "id": IntegerType(minimum=0),
                "slot": StringType(range(1, 24)),
                "mods": ListType(
                    StringType(range(2, 3),options=VALID_MODS),
                    unique=True,
                    unique_check=lambda a, b: a.upper() != b.upper()
                )
            }),
            max_len=32,
            min_len=1,
            unique=True,
            unique_check=lambda a, b: a["id"] != b["id"] and a["slot"].upper() != b["slot"].upper()
        )
    })
)
async def create_mappool(req, data):
    beatmap_ids = []
    slots = []
    mods = []
    for bm_id, slot, bm_mods in map(lambda bm: (bm["id"], bm["slot"], bm["mods"]), data["beatmaps"]):
        beatmap_ids.append(bm_id)
        slots.append(slot)
        mods.append(bm_mods)

    user = await req.auser()
    mappool_id = data.get("id") or 0

    # editing mappool
    if mappool_id != 0:
        mappool = await Mappool.objects.filter(id=mappool_id).afirst()
        if mappool is None:
            return error("Invalid beatmap id", 400)
        if mappool.submitted_by_id != user.id:
            return error("Cannot edit a mappool not submitted by you", 403)

    mappool = await Mappool.new(data["name"], user, beatmap_ids, slots, mods, mappool_id=data["id"] or 0)

    serializer = MappoolSerializer(mappool)
    return JsonResponse(serializer.serialize(), safe=False)


@requires_auth
async def delete_mappool(req, mappool_id):
    mappool = await Mappool.objects.filter(id=mappool_id).afirst()
    if mappool is None:
        return error("Invalid mappool id", 404)

    user = await req.auser()
    if mappool.submitted_by_id != user.id:
        return error("You cannot delete a mappool submitted by another person", 403)

    await mappool.adelete()

    return HttpResponse(b"", status=200)


@require_method("POST")
@requires_auth
@accepts_json_data(
    DictionaryType({"favorite": BoolType()})
)
async def favorite_mappool(req, mappool_id, data):
    # TODO: make postgresql function for this?

    try:
        mappool = await Mappool.objects.aget(id=mappool_id)
    except Mappool.DoesNotExist:
        return error("Invalid mappool id", 400)

    user = await req.auser()
    try:
        favorite = await MappoolFavorite.objects.aget(mappool_id=mappool.id, user_id=user.id)
    except MappoolFavorite.DoesNotExist:
        favorite = None

    if (favorite is not None and data["favorite"]) or (favorite is None and not data["favorite"]):
        return HttpResponse(b"", 200)

    if data["favorite"]:
        await MappoolFavorite.objects.acreate(mappool_id=mappool.id, user_id=user.id, timestamp=time.time()//1)
    else:
        await favorite.adelete()

    return HttpResponse(b"", 200)


@require_method("GET")
async def search_mappools(req):
    def search(req):
        return list(Mappool.objects.annotate(
            search=SearchVector(
                "name",
                "tournament_connections__name_override",
                "tournament_connections__tournament__name",
                "tournament_connections__tournament__abbreviation",
                "tournament_connections__tournament__description"
            )
        ).filter(search=SearchQuery(req.GET.get("q", "")))[:20])

    result = await sync_to_async(search)(req)
    return JsonResponse(MappoolSerializer(result, many=True).serialize(), safe=False)
