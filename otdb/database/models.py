from django.db import models, connection
from django.contrib.auth import get_user_model
from django.conf import settings

from common.models import enum_field
from common.exceptions import ClientException, ServerException
from common.util import sql_s, unzip, find_invalids

from osu import AsynchronousClient, Beatmap, Mods, Mod
from enum import IntFlag
from aiohttp import ClientSession
from asgiref.sync import sync_to_async
import aiofiles
import rosu_pp_py as rosu
import logging
import asyncio
import os
import itertools


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
                    raise ServerException(f"I've been ratelimited by the osu site :( try again later")
                
                if 500 <= resp.status <= 599:
                    raise ServerException(f"Unexpected error from osu server")
                
                resp.raise_for_status()

                async with aiofiles.open(path, mode="wb") as f:
                    await f.write(await resp.read())

    async def get_beatmap_attributes(self, beatmap: Beatmap, mods: int) -> rosu.DifficultyAttributes:
        await self._lock.acquire()

        osu_path = os.path.join(self.CACHE_DIR, f"{beatmap.checksum}.osu")

        if not os.path.exists(osu_path):
            print("Downloading "+beatmap.checksum)
            await self._download(beatmap.id, osu_path)

        self._lock.release()

        async with aiofiles.open(osu_path, mode="rb") as f:
            rosu_beatmap = rosu.Beatmap(bytes=await f.read())
        difficulty = rosu.Difficulty(mods=mods).calculate(rosu_beatmap)

        return difficulty


OsuUser = get_user_model()
osu_client: AsynchronousClient = settings.OSU_CLIENT
log = logging.getLogger(__name__)
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


@enum_field(UserRoles, models.PositiveIntegerField)
class UserRolesField:
    pass


class BeatmapsetMetadata(models.Model):
    id = models.PositiveIntegerField(primary_key=True)
    artist = models.CharField(max_length=256)
    title = models.CharField(max_length=256)
    creator = models.CharField(max_length=15)

    def __str__(self):
        return str(self.id)


class BeatmapMetadata(models.Model):
    id = models.PositiveIntegerField(primary_key=True)
    difficulty = models.CharField(max_length=256)
    ar = models.FloatField()
    od = models.FloatField()
    cs = models.FloatField()
    hp = models.FloatField()
    length = models.PositiveIntegerField()
    bpm = models.FloatField()

    def __str__(self):
        return str(self.id)


class BeatmapMod(models.Model):
    acronym = models.CharField(max_length=2)
    settings = models.JSONField(null=True)


class MappoolBeatmap(models.Model):
    # TODO: account for other gamemodes
    beatmapset_metadata = models.ForeignKey(BeatmapsetMetadata, models.PROTECT, related_name="mappool_beatmaps")
    beatmap_metadata = models.ForeignKey(BeatmapMetadata, models.PROTECT, related_name="mappool_beatmaps")
    slot = models.CharField(max_length=8)
    mods = models.ManyToManyField(BeatmapMod, "related_beatmaps")
    star_rating = models.FloatField()

    @staticmethod
    async def get_rows_data(beatmap: Beatmap, slot: str, mods: tuple[str | None, ...]):
        mods_flag = 0
        for mod in filter(lambda m: m is not None, mods):
            try:
                mods_flag += Mods[Mod(mod).name].value
            except (ValueError, KeyError):
                continue
        difficulty = await beatmap_cache.get_beatmap_attributes(beatmap, mods_flag)

        bms = beatmap.beatmapset

        bms_row = "ROW(%d, %s, %s, %s)::database_beatmapsetmetadata" % (
            int(bms.id),
            sql_s(bms.artist),
            sql_s(bms.title),
            sql_s(bms.creator)
        )
        bm_row = "ROW(%d, %s, %f, %f, %f, %f, %f, %f)::database_beatmapmetadata" % (
            int(beatmap.id),
            sql_s(beatmap.version),
            beatmap.ar,
            beatmap.accuracy,
            beatmap.cs,
            beatmap.drain,
            beatmap.total_length,
            beatmap.bpm
        )
        mpbm_row = "ROW(0, %s, %f, %d, %d)::database_mappoolbeatmap" % (
            sql_s(slot),
            difficulty.stars,
            int(beatmap.id),
            int(bms.id)
        )
        mods_row = "ARRAY[" + ",".join(map(
            lambda mod: ("ROW(0, %s, null)" % sql_s(mod)) if mod is not None else "null",
            mods
        )) + "]::database_beatmapmod[]"

        return mpbm_row, bm_row, bms_row, mods_row

    def __str__(self):
        return self.slot


class Mappool(models.Model):
    name = models.CharField(max_length=64)
    beatmaps = models.ManyToManyField(MappoolBeatmap, "mappools")
    submitted_by = models.ForeignKey(OsuUser, models.PROTECT, related_name="submitted_mappools")
    favorites = models.ManyToManyField(OsuUser, through="MappoolFavorite", related_name="mappool_favorites")
    avg_star_rating = models.FloatField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @staticmethod
    def _new_mappool(cls, id: int, name: str, submitted_by: OsuUser, data):
        with connection.cursor() as cursor:
            cursor.execute("SELECT \"new_mappool\"(%s, %d, ARRAY[%s], ARRAY[%s], ARRAY[%s], ARRAY[%s], %d)" % (
                sql_s(name),
                submitted_by.id,
                *map(",".join, unzip(data)),
                id
            ))
            return cls(id=cursor.fetchone()[0], name=name, submitted_by=submitted_by)

    @classmethod
    async def new(
        cls,
        name: str,
        submitted_by: OsuUser,
        beatmap_ids: list[int],
        slots: list[str],
        mods: list[list[str]],
        mappool_id: int = 0
    ):
        beatmaps = await osu_client.get_beatmaps(beatmap_ids)

        if len(beatmaps) != len(beatmap_ids):
            raise ClientException(
                f"Invalid beatmap id(s): "
                f"{', '.join(map(str, find_invalids(beatmap_ids, beatmaps, lambda id, b: b.id == id)))}"
            )

        beatmaps = sorted(beatmaps, key=lambda b: beatmap_ids.index(b.id))

        max_mods = sorted(map(len, mods))[-1]
        # not using gather as to not barrage the site
        data = [
            await MappoolBeatmap.get_rows_data(
                beatmaps[i],
                slots[i].upper(),
                tuple(map(str.upper, mods[i])) + tuple((None for _ in range(max_mods - len(mods[i]))))
            )
            for i in range(len(beatmaps))
        ]

        return await sync_to_async(cls._new_mappool)(cls, mappool_id, name, submitted_by, data)

    async def is_favorited(self, user_id: int):
        return await MappoolFavorite.objects.filter(mappool_id=self.id, user_id=user_id).acount() > 0

    def __str__(self):
        return self.name


class Tournament(models.Model):
    name = models.CharField(max_length=128, unique=True)
    abbreviation = models.CharField(max_length=16, default="")
    link = models.CharField(max_length=256, default="")
    description = models.CharField(max_length=512, default="")
    involved_users = models.ManyToManyField(OsuUser, through="TournamentInvolvement")
    mappools = models.ManyToManyField(Mappool, through="MappoolConnection")
    submitted_by = models.ForeignKey(OsuUser, models.PROTECT, related_name="submitted_tournaments")
    favorites = models.ManyToManyField(OsuUser, through="TournamentFavorite", related_name="tournament_favorites")

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
        user_rows = (f"ROW({u[0]},{sql_s(u[1])},{sql_s(u[2])},{sql_s(u[3])},0)::main_osuuser" for u in users)
        mappool_rows = (f"ROW(0,{sql_s(conn['name_override'] or "null")},{conn['id']},0)::database_mappoolconnection" for conn in mappools)

        with connection.cursor() as cursor:
            cursor.execute("SELECT \"new_tournament\"(%d, %s, %s, %s, %s, %d, %s, %s, %s)" % (
                tournament_id,
                sql_s(name),
                sql_s(abbr),
                sql_s(description),
                sql_s(link),
                submitted_by_id,
                "ARRAY[%s]::main_osuuser[]" % ",".join(user_rows),
                "ARRAY[%s]::integer[]" % ",".join(map(str, roles)),
                "ARRAY[%s]::database_mappoolconnection[]" % ",".join(mappool_rows)
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
        submitted_by_id: int,
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
                    f"{', '.join(map(str, find_invalids(user_ids, batch_users, lambda id, u: u.id == id)))}"
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
            mappools,
            tournament_id
        )
    
    async def is_favorited(self, user_id: int):
        return await TournamentFavorite.objects.filter(tournament_id=self.id, user_id=user_id).acount() > 0

    def __str__(self):
        return self.name


class TournamentInvolvement(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="involvements")
    user = models.ForeignKey(OsuUser, on_delete=models.CASCADE)
    roles = UserRolesField(default=0)


class MappoolConnection(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="mappool_connections")
    mappool = models.ForeignKey(Mappool, on_delete=models.CASCADE, related_name="tournament_connections")
    name_override = models.CharField(max_length=64, null=True)

    def __str__(self):
        return self.name_override if self.name_override is not None else ""


class MappoolFavorite(models.Model):
    mappool = models.ForeignKey(Mappool, models.CASCADE)
    user = models.ForeignKey(OsuUser, models.CASCADE)
    timestamp = models.PositiveBigIntegerField()


class TournamentFavorite(models.Model):
    tournament = models.ForeignKey(Tournament, models.CASCADE)
    user = models.ForeignKey(OsuUser, models.CASCADE)
    timestamp = models.PositiveBigIntegerField()
