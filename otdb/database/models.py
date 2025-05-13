from django.db import models, connection
from django.contrib.auth import get_user_model
from django.conf import settings

from common.models import enum_field, SerializableModel
from common.exceptions import ClientException, ServerException
from common.util import unzip, find_invalids

from osu import AsynchronousClient, Beatmap, Mods, Mod, GameModeStr
from enum import IntFlag
from aiohttp import ClientSession
from asgiref.sync import sync_to_async
import aiofiles
import rosu_pp_py as rosu
import logging
import asyncio
import os
import itertools


OsuUser = get_user_model()
osu_client: AsynchronousClient = settings.OSU_CLIENT
log = logging.getLogger(__name__)


class BeatmapCacheManager:
    CACHE_DIR = os.path.join(settings.BASE_DIR, "cache")

    def __init__(self) -> None:
        if not os.path.isdir(self.CACHE_DIR):
            os.mkdir(self.CACHE_DIR)

        self._lock = asyncio.Lock()

    @staticmethod
    async def _download(id: int, path: str):
        async with ClientSession() as session:
            async with session.get(f"https://osu.ppy.sh/osu/{id}") as resp:
                # shouldn't happen, but just in case
                if resp.status == 404:
                    raise ClientException(f"Invalid beatmap id: {id}")

                if resp.status == 429:
                    raise ServerException(f"I've been rate limited by the osu site :( try again later")

                if 500 <= resp.status <= 599:
                    raise ServerException(f"Unexpected error from osu server")

                resp.raise_for_status()

                async with aiofiles.open(path, mode="wb") as f:
                    await f.write(await resp.read())

    async def get_beatmap_attributes(self, beatmap: Beatmap, mods: int) -> rosu.DifficultyAttributes:
        # osu doesn't like concurrent requests to this endpoint
        await self._lock.acquire()

        osu_path = os.path.join(self.CACHE_DIR, f"{beatmap.checksum}.osu")

        if not os.path.exists(osu_path):
            log.info("Downloading " + beatmap.checksum)
            await self._download(beatmap.id, osu_path)

        self._lock.release()

        async with aiofiles.open(osu_path, mode="rb") as f:
            rosu_beatmap = rosu.Beatmap(bytes=await f.read())
        difficulty = rosu.Difficulty(mods=mods).calculate(rosu_beatmap)

        return difficulty


beatmap_cache = BeatmapCacheManager()


class UserRoles(IntFlag):
    REFEREE = 1 << 0
    STREAMER = 1 << 1
    COMMENTATOR = 1 << 2
    PLAYTESTER = 1 << 3
    MAPPOOLER = 1 << 4
    MAPPOOL_ASSURANCE = 1 << 5
    MAPPER = 1 << 6
    SHEETER = 1 << 7
    HOST = 1 << 8
    GRAPHICS = 1 << 9
    ADMIN = 1 << 10
    STATISTICIAN = 1 << 11
    OTHER = 1 << 12


@enum_field(UserRoles, models.PositiveIntegerField)
class UserRolesField:
    pass


class BeatmapsetMetadata(SerializableModel):
    id = models.PositiveIntegerField(primary_key=True)
    artist = models.CharField(max_length=256)
    title = models.CharField(max_length=256)
    creator = models.CharField(max_length=15)

    class Serialization:
        FIELDS = ["id", "artist", "title", "creator"]

    def __str__(self):
        return str(self.id)


class BeatmapMetadata(SerializableModel):
    id = models.PositiveIntegerField(primary_key=True)
    difficulty = models.CharField(max_length=256)
    ar = models.FloatField()
    od = models.FloatField()
    cs = models.FloatField()
    hp = models.FloatField()
    length = models.PositiveIntegerField()
    bpm = models.FloatField()

    class Serialization:
        FIELDS = ["id", "difficulty", "ar", "od", "cs", "hp", "length", "bpm"]

    def __str__(self):
        return str(self.id)


class BeatmapMod(SerializableModel):
    acronym = models.CharField(max_length=2)
    settings = models.JSONField(default=dict)

    class Serialization:
        FIELDS = ["id", "acronym", "settings"]

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["acronym", "settings"], name="beatmapmod_unique_constraint")
        ]


class MappoolBeatmap(SerializableModel):
    beatmapset_metadata = models.ForeignKey(BeatmapsetMetadata, models.PROTECT, related_name="mappool_beatmaps")
    beatmap_metadata = models.ForeignKey(BeatmapMetadata, models.PROTECT, related_name="mappool_beatmaps")
    mods = models.ManyToManyField(BeatmapMod, "related_beatmaps")
    star_rating = models.FloatField()

    class Serialization:
        FIELDS = ["id", "star_rating"]

    @staticmethod
    async def get_rows_data(beatmap: Beatmap, mods: tuple[str | None, ...]):
        mods_flag = 0
        for mod in filter(lambda m: m is not None, mods):
            try:
                mods_flag += Mods[Mod(mod).name].value
            except AttributeError:
                continue
        difficulty = await beatmap_cache.get_beatmap_attributes(beatmap, mods_flag)

        bms = beatmap.beatmapset

        return (
            (  # beatmapset metadata
                bms.id,
                bms.artist,
                bms.title,
                bms.creator
            ),
            (  # beatmap metadata
                beatmap.id,
                beatmap.version,
                beatmap.ar,
                beatmap.accuracy,
                beatmap.cs,
                beatmap.drain,
                beatmap.total_length,
                beatmap.bpm
            ),
            (  # mappool beatmap
                difficulty.stars,
                beatmap.id,
                bms.id
            ),
            (
                mods
            )
        )

    def __str__(self):
        return self.slot


class MappoolBeatmapConnection(SerializableModel):
    mappool = models.ForeignKey("Mappool", models.CASCADE, related_name="beatmap_connections")
    beatmap = models.ForeignKey(MappoolBeatmap, models.CASCADE, related_name="mappool_connections")
    slot = models.CharField(max_length=12)

    class Serialization:
        FIELDS = ["slot"]


class Mappool(SerializableModel):
    name = models.CharField(max_length=128)
    description = models.CharField(max_length=1024, default="")
    beatmaps = models.ManyToManyField(MappoolBeatmap, "mappools", through=MappoolBeatmapConnection)
    submitted_by = models.ForeignKey(OsuUser, models.SET_NULL, related_name="submitted_mappools", null=True)
    favorites = models.ManyToManyField(OsuUser, through="MappoolFavorite", related_name="mappool_favorites")
    avg_star_rating = models.FloatField()

    class Serialization:
        FIELDS = ["id", "name", "description", "avg_star_rating"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @staticmethod
    def _new_mappool(cls, id: int, name: str, description: str, slots: list[str], submitted_by: OsuUser | None, data: list[tuple[tuple, tuple, tuple, tuple]]):
        n_beatmaps = len(slots)

        slots_string = f"ARRAY[{','.join(('%s' for _ in range(n_beatmaps)))}]"
        mp_beatmaps_string = f"ARRAY[{','.join(('ROW(0, %s, %s, %s)::database_mappoolbeatmap' for _ in range(n_beatmaps)))}]"
        beatmaps_string = f"ARRAY[{','.join(('ROW(%s, %s, %s, %s, %s, %s, %s, %s)::database_beatmapmetadata' for _ in range(n_beatmaps)))}]"
        beatmapsets_string = f"ARRAY[{','.join(('ROW(%s, %s, %s, %s)::database_beatmapsetmetadata' for _ in range(n_beatmaps)))}]"
        mods_string = f"ARRAY[{','.join(('ROW(0,%s,\'\x7B\x7D\')' for _ in range(len(data[0][3]))))}]::database_beatmapmod[]"
        all_mods_string = f"ARRAY[{','.join((mods_string for _ in range(n_beatmaps)))}]"

        with connection.cursor() as cursor:
            cursor.execute(f"SELECT \"new_mappool\"(%s::text, %s::text, %s, {slots_string}, {mp_beatmaps_string}, {beatmaps_string}, {beatmapsets_string}, {all_mods_string}, %s)", (
                name,
                description,
                None if submitted_by is None else submitted_by.id,
                *slots,
                *itertools.chain(*itertools.chain(entry[2] for entry in data)),
                *itertools.chain(*itertools.chain(entry[1] for entry in data)),
                *itertools.chain(*itertools.chain(entry[0] for entry in data)),
                *itertools.chain(*itertools.chain(entry[3] for entry in data)),
                id
            ))
            return cls(id=cursor.fetchone()[0], name=name, description=description, submitted_by=submitted_by)

    @classmethod
    async def new(
        cls,
        name: str,
        description: str,
        submitted_by: OsuUser | None,
        beatmap_ids: list[int],
        slots: list[str],
        mods: list[list[str]],
        mappool_id: int = 0
    ):
        beatmaps = await osu_client.get_beatmaps(beatmap_ids)

        for beatmap in beatmaps:
            if beatmap.mode != GameModeStr.STANDARD:
                raise ClientException("Sorry! Only osu!std mappools are supported at the moment.")

        unique_beatmap_ids = set(beatmap_ids)
        if len(beatmaps) != len(unique_beatmap_ids):
            raise ClientException(
                f"Invalid beatmap id(s): "
                f"{', '.join(map(str, find_invalids(beatmaps, unique_beatmap_ids, lambda b, id: b.id == id)))}"
            )

        beatmaps = [next((beatmap for beatmap in beatmaps if beatmap.id == id)) for id in beatmap_ids]

        max_mods = max(map(len, mods))
        data = await asyncio.gather(*(
            MappoolBeatmap.get_rows_data(
                beatmaps[i],
                tuple(map(str.upper, mods[i])) + tuple((None for _ in range(max_mods - len(mods[i]))))
            )
            for i in range(len(beatmaps))
        ))

        return await sync_to_async(cls._new_mappool)(cls, mappool_id, name, description, slots, submitted_by, data)

    async def is_favorited(self, user_id: int):
        return await MappoolFavorite.objects.filter(mappool_id=self.id, user_id=user_id).acount() > 0

    def __str__(self):
        return self.name


class Tournament(SerializableModel):
    name = models.CharField(max_length=128, unique=True)
    abbreviation = models.CharField(max_length=16, default="")
    link = models.CharField(max_length=256, default="")
    description = models.CharField(max_length=1024, default="")
    involved_users = models.ManyToManyField(OsuUser, through="TournamentInvolvement")
    mappools = models.ManyToManyField(Mappool, through="MappoolConnection")
    submitted_by = models.ForeignKey(OsuUser, models.SET_NULL, related_name="submitted_tournaments", null=True)
    favorites = models.ManyToManyField(OsuUser, through="TournamentFavorite", related_name="tournament_favorites")

    class Serialization:
        FIELDS = ["id", "name", "abbreviation", "link", "description"]
        TRANSFORM = {
            "involvements": "staff"
        }

    @staticmethod
    def _new_tournament(
        cls,
        name: str,
        abbr: str,
        description: str,
        link: str,
        submitted_by_id: int,
        users: list[tuple],
        roles: list[int],
        mappools: list,
        tournament_id: int = 0
    ):
        users_string = f"ARRAY[{','.join(('ROW(%s,%s,%s,%s,0)::main_osuuser' for _ in range(len(users))))}]::main_osuuser[]"
        roles_string = f"ARRAY[{','.join(('%s' for _ in range(len(roles))))}]::integer[]"
        mappools_string = f"ARRAY[{','.join(('ROW(0,%s,%s,0)::database_mappoolconnection' for _ in range(len(mappools))))}]::database_mappoolconnection[]"

        with connection.cursor() as cursor:
            cursor.execute(f"SELECT \"new_tournament\"(%s, %s, %s, %s, %s, %s, {users_string}, {roles_string}, {mappools_string})", (
                tournament_id,
                name,
                abbr,
                description,
                link,
                submitted_by_id,
                *itertools.chain(*users),
                *roles,
                *itertools.chain(*mappools)
            ))
            return cls(
                id=cursor.fetchone()[0],
                name=name,
                abbreviation=abbr,
                link=link,
                description=description,
                submitted_by_id=submitted_by_id
            )

    @classmethod
    async def new(
        cls,
        name: str,
        abbr: str,
        description: str,
        link: str,
        submitted_by_id: int | None,
        staff: list,
        mappools: list,
        tournament_id: int = 0
    ):
        user_ids = [user["id"] for user in staff]
        users = []
        for batch in itertools.batched(user_ids, 50):
            batch_users = await osu_client.get_users(batch)
            if len(batch_users) != len(batch):
                raise ClientException(
                    f"Invalid user id(s): "
                    f"{', '.join(map(str, find_invalids(batch_users, user_ids, lambda u, id: u.id == id)))}"
                )

            users += sorted(batch_users, key=lambda u: user_ids.index(u.id))

        return await sync_to_async(cls._new_tournament)(
            cls,
            name,
            abbr or "",
            description or "",
            link or "",
            submitted_by_id,
            [(
                user.id,
                user.username,
                user.avatar_url,
                user.cover.url
            ) for user in users],
            [user["roles"] for user in staff],
            [(mappool["name_override"], mappool["id"]) for mappool in mappools],
            tournament_id
        )
    
    async def is_favorited(self, user_id: int):
        return await TournamentFavorite.objects.filter(tournament_id=self.id, user_id=user_id).acount() > 0

    def __str__(self):
        return self.name


class TournamentInvolvement(SerializableModel):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="involvements")
    user = models.ForeignKey(OsuUser, on_delete=models.CASCADE, related_name="involvements")
    roles = UserRolesField(default=0)

    class Serialization:
        FIELDS = ["roles"]

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tournament", "user"], name="tournamentinvolvement_unique_constraint")
        ]


class MappoolConnection(SerializableModel):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="mappool_connections")
    mappool = models.ForeignKey(Mappool, on_delete=models.CASCADE, related_name="tournament_connections")
    name_override = models.CharField(max_length=64, null=True)

    class Serialization:
        FIELDS = ["name_override"]

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tournament", "mappool"], name="mappoolconnection_unique_constraint")
        ]

    def __str__(self):
        return self.name_override if self.name_override is not None else ""


class MappoolFavorite(SerializableModel):
    mappool = models.ForeignKey(Mappool, models.CASCADE, related_name="favorite_connections")
    user = models.ForeignKey(OsuUser, models.CASCADE, related_name="mappool_favorite_connections")
    timestamp = models.PositiveBigIntegerField()

    class Serialization:
        FIELDS = ["timestamp"]


class TournamentFavorite(SerializableModel):
    tournament = models.ForeignKey(Tournament, models.CASCADE, related_name="favorite_connections")
    user = models.ForeignKey(OsuUser, models.CASCADE, related_name="tournament_favorite_connections")
    timestamp = models.PositiveBigIntegerField()

    class Serialization:
        FIELDS = ["timestamp"]
