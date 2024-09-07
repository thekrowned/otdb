from django.http import JsonResponse

from .exceptions import ExpectedException

import logging

log = logging.getLogger(__name__)


class ExceptionHandlingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def process_exception(self, req, exc):
        if isinstance(exc, ExpectedException):
            return JsonResponse({"error": exc.args[0]}, safe=False, status=exc.args[1])

        log.exception(exc)

    def __call__(self, *args, **kwargs):
        return self.get_response(*args, **kwargs)
