from django.db import models
from django.conf import settings

from osu import AsynchronousClient, AsynchronousAuthHandler, Scope
from datetime import datetime, timezone, time
from asgiref.sync import sync_to_async

from common.models import SerializableModel


osu_client: AsynchronousClient = settings.OSU_CLIENT


class UserManager(models.Manager):
    async def create_user(self, code):
        auth = AsynchronousAuthHandler(
            settings.OSU_CLIENT_ID,
            settings.OSU_CLIENT_SECRET,
            settings.OSU_CLIENT_REDIRECT_URI,
            scope=Scope.identify()
        )
        try:
            await auth.get_auth_token(code)
            client = AsynchronousClient(auth)
            data = await client.get_own_data()
        except:
            return

        user = await OsuUser.from_data(data)
        await user.asave()
        return user


class OsuUser(SerializableModel):
    is_anonymous = False
    is_authenticated = True

    id = models.PositiveBigIntegerField(unique=True, primary_key=True)
    username = models.CharField(max_length=15)
    avatar = models.CharField()
    cover = models.CharField()

    is_admin = models.BooleanField(default=False)

    REQUIRED_FIELDS = []
    # this field has to be unique but there is a scenario where
    # the username could not be unique
    USERNAME_FIELD = "id"
    objects = UserManager()

    class Serialization:
        FIELDS = ["id", "username", "avatar", "cover", "is_admin"]
        TRANSFORM = {
            "involvements": "staff_roles",
            "mappool_favorite_connections": "mappool_favorites",
            "tournament_favorite_connections": "tournament_favorites"
        }

    @classmethod
    async def from_data(cls, data):
        try:
            user = await OsuUser.objects.aget(id=data.id)
            user.username = data.username
            user.avatar = data.avatar_url
            user.cover = data.cover.url
            return user
        except OsuUser.DoesNotExist:
            return cls(
                id=data.id,
                username=data.username,
                avatar=data.avatar_url,
                cover=data.cover.url
            )

    def __str__(self):
        return self.username


class TrafficStatistic(SerializableModel):
    timestamp = models.DateTimeField()
    traffic = models.PositiveBigIntegerField(default=0)

    class Serialization:
        FIELDS = ["timestamp", "traffic"]

    @classmethod
    def _now(cls):
        now = datetime.now(tz=timezone.utc)
        now_hour = datetime.combine(now, time(hour=now.hour), tzinfo=timezone.utc)

        return cls.objects.get_or_create(timestamp=now_hour)[0]

    @classmethod
    async def now(cls):
        return await sync_to_async(cls._now)()


class SQLFuncMigration(SerializableModel):
    filename = models.CharField(max_length=255)
    last_state = models.CharField(max_length=255)
