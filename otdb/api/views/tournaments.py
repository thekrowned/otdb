from django.http import Http404

from .util import *
from common.validation import *
from .listing import Listing
from database.models import *

import time


__all__ = (
    "get_full_tournament",
    
    "tournaments",
    "favorite_tournament",
)


class TournamentListing(Listing[Tournament]):
    MODEL = Tournament
    SEARCH_FIELDS = ("name", "abbreviation", "description")


async def get_full_tournament(user, id):
    try:
        tournament = await Tournament.objects.annotate(
            favorite_count=models.Count("favorites")
        ).prefetch_related(
            "involvements__user",
            "mappool_connections",
            models.Prefetch(
                "mappool_connections__mappool",
                queryset=Mappool.objects.annotate(
                    favorite_count=models.Count("favorite_connections")
                )
            ),
        ).select_related("submitted_by").aget(id=id)
    except Tournament.DoesNotExist:
        return
    
    data = tournament.serialize(
        includes=["involvements__user", "submitted_by", "mappool_connections__mappool__favorite_count", "favorite_count"],
        excludes=["mappool_connections__tournament_id"]
    )
    
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

    tournament_list, total_pages = await TournamentListing(req).aget()

    return JsonResponse({
        "data": list((
            tournament.serialize(includes=["favorite_count"]) for tournament in tournament_list
        )),
        "total_pages": total_pages
    }, safe=False)


@requires_auth
@accepts_json_data(
    DictionaryType({
        "name": StringType(range(1, 129)),
        "abbreviation": StringType(range(0, 17), optional=True),
        "link": StringType(range(0, 257), optional=True),
        "description": StringType(range(0, 1025), optional=True),
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

    return JsonResponse(tournament.serialize(), safe=False)


@requires_auth
async def delete_tournament(req, id):
    tournament = await Tournament.objects.filter(id=id).afirst()
    if tournament is None:
        return error("Invalid tournament id", 404)

    user = await req.auser()
    if tournament.submitted_by_id != user.id and not user.is_admin:
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
