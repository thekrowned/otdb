from django.http import Http404

from common.views import render
from main.models import TrafficStatistic

from asgiref.sync import sync_to_async


def require_admin(func):
    async def wrapper(req, *args, **kwargs):
        user = await req.auser()
        if not user.is_authenticated or not user.is_admin:
            raise Http404()

        return await func(req, *args, **kwargs)

    return wrapper


@require_admin
async def index(req):
    def get_traffic():
        return list(TrafficStatistic.objects.order_by("-timestamp")[:24])

    return await render(req, "admin/index.html", extra_context={
        "statistics": reversed(await sync_to_async(get_traffic)())
    })
