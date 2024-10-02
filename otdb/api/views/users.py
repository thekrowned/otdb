from .util import *
from main.models import *
from database.models import *


__all__ = (
    "users",
)


@require_method("GET")
async def users(req, id):
    try:
        user = await OsuUser.objects.prefetch_related(
            models.Prefetch(
                "involvements__tournament",
                queryset=Tournament.objects.annotate(
                    favorite_count=models.Count("favorites")
                )
            ),
            models.Prefetch(
                "tournament_favorite_connections__tournament",
                queryset=Tournament.objects.annotate(
                    favorite_count=models.Count("favorites")
                )
            ),
            models.Prefetch(
                "mappool_favorite_connections__mappool",
                queryset=Mappool.objects.annotate(
                    favorite_count=models.Count("favorites")
                )
            )
        ).aget(id=id)
        OsuUser.objects.values()
    except OsuUser.DoesNotExist:
        return error("Invalid user id", 400)

    return JsonResponse(user.serialize(
        includes=[
            "involvements__tournament__favorite_count",
            "tournament_favorite_connections__tournament__favorite_count",
            "mappool_favorite_connections__mappool__favorite_count",
        ]
    ), safe=False)
