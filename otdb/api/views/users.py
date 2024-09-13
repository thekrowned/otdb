from ..serializers import *
from .util import *


__all__ = (
    "users",
)


@require_method("GET")
async def users(req, id):
    try:
        user = await OsuUser.objects.aget(id=id)
    except OsuUser.DoesNotExist:
        return error("Invalid user id", 400)

    return JsonResponse(OsuUserSerializer(user).serialize(), safe=False)
