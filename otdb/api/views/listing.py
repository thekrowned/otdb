from django.db import models
from django.contrib.postgres import search

from asgiref.sync import sync_to_async
from typing import Type, TypeVar
import time

from .util import option_query_param, int_query_param


_T = TypeVar('_T', bound=type[models.Model])
LISTING_ITEMS_PER_PAGE = 15


class ListingSort:
    __slots__ = ("_column", "_desc", "extra")

    def __init__(self, column: str, **extra):
        self._column = column
        self._desc = True
        self.extra = extra

    def __str__(self):
        return ("-" if self._desc else "+") + self._column


class Listing[_T]:
    __slots__ = ("_model", "sort", "page", "query", "filters", "extra")

    SORT_OPTIONS: dict[str, ListingSort] = {
        "recent": ListingSort("id"),
        "favorites": ListingSort("favorite_count"),
        "trending": ListingSort(
            "recent_favorites",
            recent_favorites=models.Count(
                "favorite_connections",
                filter=models.Q(favorite_connections__timestamp__gt=time.time() // 1 - 604800)
            )
        )
    }
    SEARCH_FIELDS: tuple[str] = ()
    MODEL: Type[_T]

    SORT = option_query_param(
        tuple(SORT_OPTIONS.keys()),
        "recent"
    )
    PAGE = int_query_param(range(1, 9999999), 1)

    @property
    def cls(self):
        return self.__class__

    def __init__(self, req):
        self.sort: ListingSort = self.cls.SORT_OPTIONS[self.cls.SORT(req.GET.get("s", "recent").lower())]
        self.page: int = self.cls.PAGE(req.GET.get("p", 1))
        self.query: str = req.GET.get("q", "").strip()

        self.extra = {}
        self.filters = {}

        if self.query:
            self.extra["search"] = search.SearchVector(*self.cls.SEARCH_FIELDS)
            self.filters["search"] = search.SearchQuery(self.query)

    async def aget(self) -> tuple[list[_T], int]:
        return await sync_to_async(self.get)()

    def get(self) -> tuple[list[_T], int]:
        offset = LISTING_ITEMS_PER_PAGE * (self.page - 1)
        limit = LISTING_ITEMS_PER_PAGE

        query = self.MODEL.objects.annotate(
            favorite_count=models.Count("favorites"),
            **self.extra,
            **self.sort.extra
        ).filter(
            **self.filters
        )

        result = query.order_by(str(self.sort))[offset:offset + limit]
        count = query.count()

        return (
            list(result),
            (count - 1) // LISTING_ITEMS_PER_PAGE + 1
        )
