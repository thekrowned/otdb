import aiofiles
import json

from django.shortcuts import redirect
from django.http import HttpResponseServerError, HttpResponseBadRequest
from django.contrib.auth import get_user_model, alogin, alogout
from django.conf import settings

from common.views import render
from common.exceptions import ClientException


User = get_user_model()


async def index(req):
    return await render(req, "main/index.html")


async def login_view(req):
    try:
        code = req.GET.get("code", None)
        if code is not None:
            user = await User.objects.create_user(code)
            if user is None:
                return HttpResponseServerError()
            await alogin(req, user, backend=settings.AUTH_BACKEND)
        return redirect(req.GET.get("state", None) or "index")
    except:
        return HttpResponseBadRequest()


async def logout_view(req):
    user = await req.auser()
    if user.is_authenticated:
        await alogout(req)
    return redirect(req.GET.get("state", None) or "index")


async def dashboard(req):
    user = await req.auser()
    if not user.is_authenticated:
        return redirect("index")
    return await render(req, "main/dashboard.html")


async def user(req, id=None):
    return await render(req, "main/user.html")


async def go_google_auth(req):
    user = await req.auser()
    if not user.is_authenticated or not user.is_admin:
        raise ClientException("Must be admin")

    return redirect(settings.GOOGLE_OAUTH_URL)


async def handle_google_auth(req):
    user = await req.auser()
    if not user.is_authenticated or not user.is_admin:
        raise ClientException("Must be admin")

    error = req.GET.get("error", None)
    if error is not None:
        raise ClientException(error)

    code = req.GET.get("code", None)
    if code is None:
        raise ClientException("No code")

    settings.GOOGLE_AUTH_FLOW.fetch_token(code=code)
    creds = settings.GOOGLE_AUTH_FLOW.credentials

    async with aiofiles.open("google-auth-creds.json", "w") as f:
        await f.write(creds.to_json())

    return redirect("index")
