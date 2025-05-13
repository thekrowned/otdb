def unzip(seq):
    """Only works if each map object is consumed before grabbing the next"""
    if len(seq) == 0:
        return

    for i in range(len(seq[0])):
        yield map(lambda item: item[i], seq)


def find_invalids(valid_items, sus_items, cmp):
    for item in sus_items:
        try:
            next(filter(lambda a: cmp(a, item), valid_items))
        except StopIteration:
            yield item
