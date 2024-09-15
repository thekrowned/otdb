import { getElementByIdOrThrow } from "../common/util";
import {APIManager, MappoolWithFavorites} from "../common/api";
import {createListing, createListingItem} from "./listing";

export function createMappoolItem(mappool: MappoolWithFavorites) {
    return createListingItem(
        mappool.id,
        mappool.name,
        mappool.favorite_count,
        "mappools",
        (Math.floor(mappool.avg_star_rating * 100) / 100).toString()+"★"
    );
}

export function mappoolsSetup() {
    const mappoolContainer = getElementByIdOrThrow("mappools-container");

    createListing<MappoolWithFavorites>(mappoolContainer, APIManager.prototype.getMappools, createMappoolItem);
}