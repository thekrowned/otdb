from django.shortcuts import redirect
from django.http import HttpResponseServerError, HttpResponseBadRequest
from django.contrib.auth import get_user_model, alogin, alogout
from django.conf import settings

from common.views import render

import requests


User = get_user_model()


async def index(req):
    return await render(req, "main/index.html")


async def authenticate(req):
    try:
        code = req.GET.get("code", None)
        if code is not None:
            user = await User.objects.create_user(code)
            if user is None:
                return HttpResponseServerError()
            await alogin(req, user, backend=settings.AUTH_BACKEND)
        return redirect(req.GET.get("state", None) or "index")
    except requests.HTTPError:
        return HttpResponseBadRequest()


async def unauthenticate(req):
    user = await req.auser()
    if user.is_authenticated:
        await alogout(req)
    return redirect(req.GET.get("state", None) or "index")


async def dashboard(req):
    user = await req.auser()
    if not user.is_authenticated:
        return redirect("index")
    return await render(req, "main/dashboard.html")
