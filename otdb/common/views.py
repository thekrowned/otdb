from django.shortcuts import render as _render
from django.conf import settings

from api.serializers import OsuUserSerializer


async def render(req, template, extra_context=None, **kwargs):
    user = await req.auser()
    context = {
        "user": user,
        "auth_url": settings.OSU_AUTH_URL+f"&state={req.path}",
        "data": {
            "user": OsuUserSerializer(user).serialize() if user.is_authenticated else None
        }
    }
    if extra_context is not None:
        context.update(extra_context)
    return _render(req, template, context, **kwargs)
