from django.db import models
from django.contrib.postgres import search

from asgiref.sync import sync_to_async
from typing import TypeVar, Iterable
import time

from .util import option_query_param, int_query_param


_T = TypeVar('_T', bound=type[models.Model])
LISTING_ITEMS_PER_PAGE = 15


def get_listing(model: _T, search_fields: Iterable[str], page: int, query: str, sort: str, **annotations) -> \
        tuple[list[_T], int]:
    offset = LISTING_ITEMS_PER_PAGE * (page - 1)
    limit = LISTING_ITEMS_PER_PAGE

    query_set = model.objects.annotate(
        favorite_count=models.Count("favorites"),
        **annotations
    )
    count_query_set = model.objects
    if query:
        q = search.SearchVector(*search_fields)
        query_set = query_set.annotate(search=q).filter(search=search.SearchQuery(query))
        count_query_set = count_query_set.annotate(search=q).filter(search=search.SearchQuery(query))

    return (
        list(query_set.order_by(sort)[offset:offset + limit]),
        (count_query_set.count() - 1) // LISTING_ITEMS_PER_PAGE + 1
    )


async def get_recent_listing(model: _T, search_fields: Iterable[str], page: int, query: str) -> tuple[list[_T], int]:
    return await sync_to_async(get_listing)(model, search_fields, page, query, "-id")


async def get_favorites_listing(model: _T, search_fields: Iterable[str], page: int, query: str) -> tuple[list[_T], int]:
    return await sync_to_async(get_listing)(model, search_fields, page, query, "-favorite_count")


async def get_trending_listing(model: _T, search_fields: Iterable[str], page: int, query: str) -> tuple[list[_T], int]:
    return await sync_to_async(get_listing)(
        model,
        search_fields,
        page,
        query,
        "-recent_favorites",
        recent_favorites=models.Count(
            "favorite_connections",
            filter=models.Q(favorite_connections__timestamp__gt=time.time() // 1 - 604800)
        )
    )


async def get_listing_from_params(model: _T, search_fields: Iterable[str], req) -> tuple[list[_T], int]:
    SORT_OPTIONS = {
        "recent": get_recent_listing,
        "favorites": get_favorites_listing,
        "trending": get_trending_listing
    }

    sort = option_query_param(tuple(SORT_OPTIONS.keys()), "recent")(req.GET.get("s", "recent").lower())
    page = int_query_param(range(1, 9999999), 1)(req.GET.get("p", 1))

    return await SORT_OPTIONS[sort](model, search_fields, page, req.GET.get("q", "").strip())
