import { getElementByIdOrThrow } from "../common/util";
import {APIManager, MappoolWithFavorites} from "../common/api";
import {createListing, createListingItem} from "./listing";
import {ElementsManager} from "../common/elements";
import {setDelayedTypeable} from "../common/interactions";

const manager = new ElementsManager();

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

    const minSrInput = getElementByIdOrThrow("min-sr-input") as HTMLInputElement;
    const maxSrInput = getElementByIdOrThrow("max-sr-input") as HTMLInputElement;

    const currentParams = new URLSearchParams(window.location.search);
    minSrInput.value = currentParams.get("min-sr") ?? "";
    maxSrInput.value = currentParams.get("max-sr") ?? "";

    const searchParams = new URLSearchParams({
        "min-sr": minSrInput.value,
        "max-sr": maxSrInput.value
    });

    const load = createListing<MappoolWithFavorites>(
        mappoolContainer,
        (params) => manager.api.getMappoolsFromParams(params),
        createMappoolItem,
        searchParams
    );

    setDelayedTypeable(minSrInput, () => {
        searchParams.set("min-sr", minSrInput.value);
        load();
    }, false);
    setDelayedTypeable(maxSrInput, () => {
        searchParams.set("max-sr", maxSrInput.value);
        load();
    }, false);
}