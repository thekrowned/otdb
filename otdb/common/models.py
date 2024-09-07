def enum_field(enum, field):
    def decorator(cls):
        return type(
            cls.__name__,
            (cls, field,),
            {
                "from_db_value": lambda self, value, expression, connection: enum(value),
                "to_python": lambda self, value: value if isinstance(value, enum) else enum(value),
                "get_prep_value": lambda self, value: value.value if isinstance(value, enum) else value
            }
        )
    return decorator
