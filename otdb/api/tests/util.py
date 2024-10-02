import json

from api.views.listing import LISTING_ITEMS_PER_PAGE


def parse_resp(resp):
    assert resp.status_code == 200, resp.content.decode("utf-8")
    return json.loads(resp.content) if resp.content else None

def get_total_pages(item_count):
    return (item_count - 1) // LISTING_ITEMS_PER_PAGE + 1
