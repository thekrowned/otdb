from django.contrib.postgres.search import SearchVector, SearchQuery

from ..serializers import *
from .util import *
from .listing import Listing
from common.validation import *

import time


__all__ = (
    "get_full_mappool",
    
    "mappools",
    "favorite_mappool",
    "search_mappools"
)


VALID_MODS = ("EZ", "HD", "HR", "DT", "FM", "RX", "HT", "NC", "FL", "AP", "SO")


class MappoolListing(Listing[Mappool]):
    MODEL = Mappool
    SEARCH_FIELDS = (
        "name",
        "tournament_connections__name_override",
        "tournament_connections__tournament__name",
        "tournament_connections__tournament__abbreviation",
        "tournament_connections__tournament__description"
    )

    MIN_SR = transform_query_param(float, None)
    MAX_SR = transform_query_param(float, None)

    def __init__(self, req):
        super().__init__(req)

        min_sr = self.cls.MIN_SR(req.GET.get("min-sr"))
        max_sr = self.cls.MAX_SR(req.GET.get("max-sr"))

        if min_sr is not None:
            self.filters["avg_star_rating__gte"] = min_sr

        if max_sr is not None:
            self.filters["avg_star_rating__lte"] = max_sr


async def get_full_mappool(user, mappool_id) -> dict | None:
    include = (
        "submitted_by",
    )
    prefetch = (
        "beatmap_connections",
        "beatmap_connections__beatmap",
        "beatmap_connections__beatmap__beatmapset_metadata",
        "beatmap_connections__beatmap__beatmap_metadata",
        "beatmap_connections__beatmap__mods"
    )

    try:
        mappool = await Mappool.objects.prefetch_related(
            *prefetch
        ).select_related(*include).aget(id=mappool_id)
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

    mappool_list, total_pages = await MappoolListing(req).aget()

    return JsonResponse(
        {
            "data": MappoolSerializer(
                mappool_list,
                many=True
            ).serialize(include=["favorite_count"]),
            "total_pages": total_pages
        },
        safe=False
    )


@requires_auth
@accepts_json_data(
    DictionaryType({
        "id": IntegerType(minimum=0, optional=True),
        "name": StringType(range(1, 65)),
        "description": StringType(range(0, 513), optional=True),
        "beatmaps": ListType(
            DictionaryType({
                "id": IntegerType(minimum=0),
                "slot": StringType(range(1, 24)),
                "mods": ListType(
                    StringType(range(2, 3), options=VALID_MODS),
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
        slots.append(slot.upper())
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

    mappool = await Mappool.new(
        data["name"],
        data.get("description") or "",
        user,
        beatmap_ids,
        slots,
        mods,
        mappool_id=data.get("id") or 0
    )

    serializer = MappoolSerializer(mappool)
    return JsonResponse(serializer.serialize(), safe=False)


@requires_auth
async def delete_mappool(req, mappool_id):
    mappool = await Mappool.objects.filter(id=mappool_id).afirst()
    if mappool is None:
        return error("Invalid mappool id", 404)

    user = await req.auser()
    if mappool.submitted_by_id != user.id and not user.is_admin:
        return error("You cannot delete a mappool submitted by another person", 403)

    await mappool.adelete()

    return HttpResponse(b"", status=200)


@require_method("POST")
@requires_auth
@accepts_json_data(
    DictionaryType({"favorite": BoolType()})
)
async def favorite_mappool(req, mappool_id, data):
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
