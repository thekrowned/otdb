from django.http import JsonResponse, HttpResponse

import json


def error(description, status):
    return JsonResponse({"error": description}, status=status)


def requires_auth(func):
    async def check(req, *args, **kwargs):
        user = await req.auser()
        if not user.is_authenticated:
            return error("Must be logged in to call this endpoint", 403)
        return await func(req, *args, **kwargs)

    return check


def accepts_json_data(fmt):
    def decorator(func):
        async def check(req, *args, **kwargs):
            try:
                data = json.loads(req.body.decode("utf-8"))
                result = fmt.validate(data)
                if result.is_failed:
                    return error(result.msg, 400)
                return await func(req, *args, data=data, **kwargs)
            except json.JSONDecodeError:
                return error("Invalid json data", 400)

        return check

    return decorator


def require_method(*methods):
    methods = [method.upper() for method in methods]

    def decorator(func):
        async def check(req, *args, **kwargs):
            if req.method.upper() not in methods:
                return HttpResponse(b"", 405)
            return await func(req, *args, **kwargs)

        return check

    return decorator


def option_query_param(options, default):
    def check(value):
        return value if value is not None and value in options else default
    
    return check


def transform_query_param(transform, default):
    def check(value):
        try:
            return transform(value)
        except (ValueError, TypeError):
            return default
        
    return check


def int_query_param(ranj, default):
    transform = transform_query_param(int, default)

    def check(value):
        value = transform(value)
        return value if value in ranj else default

    return check


def query_params(**params):
    def decorator(func):
        async def wrapper(req, *args, **kwargs):
            for k, v in params.items():
                kwargs[k] = v(req.GET.get(k))
            return await func(*args, **kwargs)
        
        return wrapper
    
    return decorator
