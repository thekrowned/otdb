from django.http import JsonResponse

from .exceptions import ExpectedException
from main.models import TrafficStatistic

import logging
import asyncio

log = logging.getLogger(__name__)


__all__ = (
    "ExceptionHandlingMiddleware",
    "TrafficStatisticsMiddleware"
)


class Middleware:
    __slots__ = ("get_response",)

    async_capable = True
    sync_capable = False

    def __init__(self, get_response):
        self.get_response = get_response

    async def __call__(self, *args, **kwargs):
        return await self.get_response(*args, **kwargs)


class ExceptionHandlingMiddleware(Middleware):

    async def process_exception(self, req, exc):
        if isinstance(exc, ExpectedException):
            return JsonResponse({"error": exc.args[0]}, safe=False, status=exc.args[1])

        log.exception(exc)


class TrafficStatisticsMiddleware(Middleware):
    async def process_view(self, req, *args, **kwargs):
        async def increment():
            stats = await TrafficStatistic.now()
            stats.traffic += 1
            await stats.asave()

        def callback(task):
            try:
                task.result()
            except Exception as exc:
                log.exception(exc)

        asyncio.create_task(increment()).add_done_callback(callback)
