from ..serializers import *
from .util import *


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
            )
        ).aget(id=id)
        OsuUser.objects.values()
    except OsuUser.DoesNotExist:
        return error("Invalid user id", 400)

    return JsonResponse(OsuUserSerializer(user).serialize(
        include=["involvements__tournament__favorite_count"]
    ), safe=False)
