class ExpectedException(Exception):
    def __init__(self, msg: str, status: int):
        super().__init__(msg, status)


class ClientException(ExpectedException):
    def __init__(self, msg: str):
        super().__init__(msg, 400)


class ServerException(ExpectedException):
    def __init__(self, msg: str):
        super().__init__(msg, 500)
