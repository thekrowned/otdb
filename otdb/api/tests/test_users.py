import pytest

from .util import parse_resp
from .. import views


@pytest.mark.django_db
class TestUsers:
    @pytest.mark.asyncio
    @pytest.mark.dependency()
    async def test_get_user(self, client, sample_user):
        req = await client.get(f"/users/{sample_user['id']}/")
        user = parse_resp(await views.users(req, sample_user['id']))

        assert user["id"] == sample_user["id"], "user id is incorrect"
        assert user["username"] == sample_user["username"], "username is incorrect"
        assert user["avatar"] == sample_user["avatar"], "avatar is incorrect"
        assert user["cover"] == sample_user["cover"], "cover is incorrect"
