def sql_s(s: str):
    return "'" + s.replace("'", "''") + "'"


def unzip(iterable):
    """Only works if each map object is consumed before grabbing the next"""
    if len(iterable) == 0:
        return

    for i in range(len(iterable[0])):
        yield map(lambda item: item[i], iterable)


def find_invalids(all_items, found_items, cmp):
    for item in found_items:
        try:
            next(filter(lambda a: cmp(item, a), all_items))
        except StopIteration:
            yield item
