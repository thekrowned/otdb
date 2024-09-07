from typing import Union, Sequence
from enum import IntEnum, IntFlag


__all__ = (
    "StringType",
    "IntegerType",
    "BoolType",
    "ListType",
    "DictionaryType",
    "FlagType",
    "ValidationType",
    "ValidationResult",
    "ValidationResultType"
)


class ValidationResultType(IntEnum):
    ALL_CLEAR = 1
    CLEAR = 2
    FAILED = 3


class ValidationResult:
    def __init__(self, typ: ValidationResultType, msg: str | None = None) -> None:
        self.type: ValidationResultType = typ
        self.msg: str | None = msg

    @classmethod
    def all_clear(cls):
        return cls(ValidationResultType.ALL_CLEAR)
    
    @classmethod
    def clear(cls):
        return cls(ValidationResultType.CLEAR)
    
    @classmethod
    def failed(cls, msg: str):
        return cls(ValidationResultType.FAILED, msg)

    @property
    def is_all_clear(self):
        return self.type == ValidationResultType.ALL_CLEAR

    @property
    def is_clear(self):
        return self.type == ValidationResultType.CLEAR

    @property
    def is_failed(self):
        return self.type == ValidationResultType.FAILED

    @property
    def is_ok(self):
        return not self.is_failed

    @property
    def is_final(self):
        """Whether this is the final verdict"""
        return self.is_all_clear or self.is_failed


class ValidationType:
    def validate(self, data) -> ValidationResult:
        raise NotImplementedError()


class OptionalType(ValidationType):
    __slots__ = ("optional",)

    def __init__(self, optional: bool = False):
        self.optional = optional

    def validate(self, data) -> ValidationResult:
        if self.optional and data is None:
            return ValidationResult.all_clear()
        return ValidationResult.clear()
    

class OptionsType(OptionalType):
    __slots__ = ("options",)

    def __init__(self, options: Sequence | None = None, optional: bool = False) -> None:
        super().__init__(optional)
        self.options: Sequence | None = options

    def validate(self, data) -> ValidationResult:
        if (result := super().validate(data)).is_final:
            return result

        if self.options is None:
            return ValidationResult.clear()

        return ValidationResult.clear() if data in self.options else \
            ValidationResult.failed("Invalid option for {name}: '%s'" % data)


class StringType(OptionsType):
    __slots__ = ("length_restraint",)

    def __init__(self, length_restraint: range | None = None, options: Sequence | None = None, optional: bool = False):
        super().__init__(options, optional)
        
        self.length_restraint: range | None = length_restraint

    def validate(self, data) -> ValidationResult:
        if (result := super().validate(data)).is_final:
            return result

        if not isinstance(data, str):
            return ValidationResult.failed("{name} must be a string")
        if self.length_restraint is not None and len(data) not in self.length_restraint:
            return ValidationResult.failed("{name} must have a length between %d and %d" % (
                self.length_restraint.start, self.length_restraint.stop-1
            ))
        
        return ValidationResult.clear()


class IntegerType(OptionalType):
    __slots__ = ("min", "max")

    def __init__(self, minimum: int | None = None, maximum: int | None = None, optional: bool = False):
        super().__init__(optional)
        self.min: int | None = minimum
        self.max: int | None = maximum

    def validate(self, data) -> ValidationResult:
        if (result := super().validate(data)).is_final:
            return result

        if not isinstance(data, int):
            return ValidationResult.failed("{name} must be an int")
        if self.min is not None and data < self.min:
            return ValidationResult.failed("{name} must be greater than %d" % self.min)
        if self.max is not None and data > self.max:
            return ValidationResult.failed("{name} must be less than %d" % self.max)
        
        return ValidationResult.clear()


class BoolType(OptionalType):
    def validate(self, data) -> ValidationResult:
        if (result := super().validate(data)).is_final:
            return result

        if not isinstance(data, bool):
            return ValidationResult.failed("{name} must be a boolean")
        
        return ValidationResult.clear()


class ListType(OptionalType):
    __slots__ = ("val_type", "max_len", "min_len", "unique", "unique_check")

    def __init__(
        self,
        val_type: "ValidationType",
        optional: bool = False,
        max_len: int = 0,
        min_len: int = 0,
        unique: bool = False,
        unique_check=None
    ):
        super().__init__(optional)

        if max_len < min_len:
            raise ValueError("Max length cannot be greater than minimum")

        self.val_type: ValidationType = val_type
        self.max_len: int = max_len
        self.min_len: int = min_len
        self.unique: bool = unique
        self.unique_check = (lambda a, b: a != b) if unique_check is None else unique_check

    def validate(self, data) -> ValidationResult:
        if (result := super().validate(data)).is_final:
            return result

        if not isinstance(data, list):
            return ValidationResult.failed("{name} must be a list")
        if 0 < self.max_len < len(data):
            return ValidationResult.failed("{name} exceeds maximum length of %d" % self.max_len)
        if len(data) < self.min_len:
            return ValidationResult.failed("{name} must meet minimum length of %d" % self.min_len)

        validated = []
        for i, item in enumerate(data):
            result = self.val_type.validate(item)
            if result.is_failed:
                return ValidationResult.failed(result.msg.replace("{name}", "{name}[%d]" % i))

            if self.unique:
                if not all(map(lambda past_item: self.unique_check(item, past_item), validated)):
                    return ValidationResult.failed("{name}[%d] is a duplicate value" % i)
                validated.append(item)

        return ValidationResult.clear()


class DictionaryType(OptionalType):
    __slots__ = ("fmt",)

    def __init__(self, fmt: dict[str, OptionalType], optional: bool = False):
        super().__init__(optional)
        self.fmt: dict[str, OptionalType] = fmt

    def validate(self, data) -> ValidationResult:
        if (result := super().validate(data)).is_final:
            return result

        for key, validator in self.fmt.items():
            if key not in data and not validator.optional:
                return ValidationResult.failed(f"{key} is missing")
            if key not in data and validator.optional:
                continue

            result = validator.validate(data[key])
            if result.is_failed:
                return ValidationResult.failed(result.msg.format(name=key)) \
                    if not isinstance(validator, DictionaryType) else result
            
        return ValidationResult.clear()


class FlagType(IntegerType):
    __slots__ = ("enum_cls",)

    def __init__(self, enum_cls: type[IntFlag], optional: bool = False):
        maximum = 0
        for flag in enum_cls.__members__.values():
            maximum |= flag.value
        super().__init__(minimum=0, maximum=maximum, optional=optional)
