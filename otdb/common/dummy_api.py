import json
import os

from osu import Beatmap, UserCompact


class DummyClient:
    __slots__ = ("user_data", "beatmap_data")

    def __init__(self, base_dir):
        dummy_data_dir = os.path.join(base_dir, "common", "dummy_api_data")
        with open(os.path.join(dummy_data_dir, "users.json"), encoding="utf-8") as f:
            self.user_data = json.load(f)

        with open(os.path.join(dummy_data_dir, "beatmaps.json"), encoding="utf-8") as f:
            self.beatmap_data = json.load(f)

    async def get_beatmaps(self, beatmap_ids):
        return [
            next((Beatmap(beatmap) for beatmap in self.beatmap_data if beatmap["id"] == beatmap_id))
            for beatmap_id in beatmap_ids
        ]

    async def get_users(self, user_ids):
        return [
            next((UserCompact(user) for user in self.user_data if user["id"] == user_id))
            for user_id in user_ids
        ]





