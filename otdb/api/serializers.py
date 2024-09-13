from django.db.models.fields.related_descriptors import ForwardManyToOneDescriptor, ReverseManyToOneDescriptor

from typing import List, Type, Dict, Iterable, Union
from collections import defaultdict

from database.models import *
from main.models import *


_SERIALIZERS: List[Type['Serializer']] = []


class Serializer:
    # TODO: incorporate select_related
    model: Type[models.Model]
    fields: List[str]
    excludes: List[str] = []
    transforms: Dict[str, str] = {}

    def __init__(self, obj: Union[models.Model, Iterable], many: bool = False):
        self.obj: Union[models.Model, Iterable] = obj
        self.many: bool = many

    def _get_serializer_of_obj(self, obj) -> Type['Serializer']:
        for serializer in _SERIALIZERS:
            if isinstance(obj, serializer.model):
                return serializer
        raise NotImplementedError(f"Could not find serializer for {obj.__class__.__name__}")

    def _get_serializer_of_model(self, model) -> Type['Serializer']:
        for serializer in _SERIALIZERS:
            if model == serializer.model:
                return serializer
        raise NotImplementedError(f"Could not find serializer for {model}")

    def _transform(self, obj, fields, exclude: dict[str, set], include: dict[str, set]):
        data = {}
        for field in fields:
            field_type = getattr(self.model, field, None)
            json_name = self.transforms[field] if field in self.transforms else field
            value = getattr(obj, field)
            if value is None or field_type is None:
                data[json_name] = value
                continue
            if isinstance(field_type, ForwardManyToOneDescriptor):
                serializer = self._get_serializer_of_obj(value)
                data[json_name] = serializer(value).serialize(
                    list(exclude.get(field, []))+serializer.excludes,
                    include.get(field)
                )
            elif isinstance(field_type, ReverseManyToOneDescriptor):
                serializer = self._get_serializer_of_model(value.model)
                data[json_name] = serializer(value.all(), many=True).serialize(
                    list(exclude.get(field, []))+serializer.excludes,
                    include.get(field)
                )
            else:
                data[json_name] = value
        return data

    def _separate_field_args(self, fields: Iterable[str], include_parents):
        now = set()
        later = defaultdict(set)
        for field in fields:
            if "__" in field:
                split_field = field.split("__", 1)
                later[split_field[0]].add(split_field[1])
                if include_parents:
                    now.add(split_field[0])
            else:
                now.add(field)
        return now, later

    def serialize(self, exclude=None, include=None):
        if exclude is None:
            exclude = self.excludes
        if include is None:
            include = []
        exclude_now, exclude_later = self._separate_field_args(exclude, False)
        include_now, include_later = self._separate_field_args(include, True)

        fields = list(self.fields)
        for field in exclude_now:
            fields.remove(field)
        for field in include_now:
            fields.append(field)

        transform = lambda obj: self._transform(obj, fields, exclude_later, include_later)
        return transform(self.obj) if not self.many else list(map(transform, self.obj))


class SerializerMeta(type):
    def __new__(cls, name, bases, attrs):
        serializer_cls = super().__new__(cls, name, bases+(Serializer,), attrs)
        _SERIALIZERS.append(serializer_cls)
        return serializer_cls


class TournamentSerializer(metaclass=SerializerMeta):
    model = Tournament
    fields = ["id", "abbreviation", "name", "description", "link", "submitted_by_id"]
    transforms = {
        "involvements": "staff"
    }


class TournamentInvolvementSerializer(metaclass=SerializerMeta):
    model = TournamentInvolvement
    fields = ["roles"]


class MappoolSerializer(metaclass=SerializerMeta):
    model = Mappool
    fields = ["id", "name", "submitted_by_id", "avg_star_rating"]


class BeatmapMetadataSerializer(metaclass=SerializerMeta):
    model = BeatmapMetadata
    fields = ["id", "difficulty", "ar", "od", "cs", "hp", "length", "bpm"]


class BeatmapsetMetadataSerializer(metaclass=SerializerMeta):
    model = BeatmapsetMetadata
    fields = ["id", "artist", "title", "creator"]


class BeatmapModSerializer(metaclass=SerializerMeta):
    model = BeatmapMod
    fields = ["acronym", "settings"]


class MappoolBeatmapSerializer(metaclass=SerializerMeta):
    model = MappoolBeatmap
    fields = ["mods", "star_rating"]


class MappoolBeatmapConnectionSerializer(metaclass=SerializerMeta):
    model = MappoolBeatmapConnection
    fields = ["slot"]


class OsuUserSerializer(metaclass=SerializerMeta):
    model = OsuUser
    fields = ["id", "username", "avatar", "cover"]


class MappoolConnectionSerializer(metaclass=SerializerMeta):
    model = MappoolConnection
    fields = ["mappool_id", "tournament_id", "name_override"]
