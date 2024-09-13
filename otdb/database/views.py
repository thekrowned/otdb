from django.shortcuts import redirect
from django.http import Http404

from common.views import render
from api import views as api_views
from .models import *


def requires_login(func):
    async def wrapper(req, *args, **kwargs):
        user = await req.auser()
        if not user.is_authenticated:
            return redirect(settings.OSU_AUTH_URL+f"&state={req.path}")
        return await func(req, *args, **kwargs)
    return wrapper


async def mappools(req, id=None):
    if id is not None:
        return await render(req, "database/mappool.html")
    return await render(req, "database/mappools.html")


@requires_login
async def new_mappool(req):
    return await render(req, "database/mappool_form.html", extra_context={"editing": False})


@requires_login
async def edit_mappool(req, id: int):
    user = await req.auser()
    mappool = await api_views.get_full_mappool(user, id)
    if mappool["submitted_by_id"] != user.id:
        raise Http404()

    return await render(req, "database/mappool_form.html", extra_context={
        "editing": True,
        "mappool": mappool
    })


async def tournaments(req, id=None):
    if id is not None:
        return await render(req, "database/tournament.html")
    return await render(req, "database/tournaments.html")


@requires_login
async def new_tournament(req):
    return await render(req, "database/tournament_form.html", extra_context={"editing": False})


@requires_login
async def edit_tournament(req, id: int):
    user = await req.auser()
    tournament = await api_views.get_full_tournament(user, id)
    if tournament["submitted_by_id"] != user.id:
        raise Http404()

    return await render(req, "database/tournament_form.html", extra_context={
        "editing": True,
        "tournament": tournament
    })


