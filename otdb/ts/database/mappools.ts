import { getElementByIdOrThrow, removeChildren } from "../common/util";
import { ElementsManager } from "../common/elements";
import { createPageNavigator, onPageClick } from "../common/navigation";
import { ListingSortType, MappoolWithFavorites } from "../common/api";
import { createListingItem } from "./listing";
import {setDelayedTypeable} from "../common/interactions";

const manager = new ElementsManager();

function createMappoolItem(mappool: MappoolWithFavorites) {
    return createListingItem(
        mappool.id,
        mappool.name,
        mappool.favorite_count,
        "mappools",
        (Math.floor(mappool.avg_star_rating * 100) / 100).toString()+"★"
    );
}

export function mappoolsSetup() {
    const params = new URLSearchParams(window.location.search);
    let sort: string = params.get("s") ?? "recent";
    let page: number = parseInt(params.get("p") ?? "1");
    let query: string = params.get("q") ?? "";
    let currentSortElm = null;

    const loadingText = getElementByIdOrThrow("loading-text");
    const mappoolContainer = getElementByIdOrThrow("mappools-container");
    const searchInput = getElementByIdOrThrow<HTMLInputElement>("search-input");

    searchInput.value = query;

    function loadPage() {
        window.history.replaceState({ s: sort, p: page }, document.title, `?s=${sort}&p=${page}&q=${query}`);
    
        removeChildren(mappoolContainer);

        loadingText.classList.remove("hidden");
    
        manager.api.getMappools(page, sort as ListingSortType, query).then((resp) => {
            loadingText.classList.add("hidden");
    
            if (resp === undefined) {
                manager.event.error("Failed to load mappools... try refreshing");
                return;
            }
            
            mappoolContainer.append(...resp.data.map(createMappoolItem));
            createPageNavigator(page, resp.total_pages, reloadPage);
        });
    }

    function reloadPage(evt: MouseEvent) {
        page = onPageClick(evt, page);
        loadPage();
    }
    
    function switchSort(elm) {
        if (elm.classList.contains("active"))
            return;

        if (currentSortElm !== null)
            currentSortElm.classList.remove("active");

        elm.classList.add("active");
        currentSortElm = elm;

        loadPage();
    }

    const sortOptions = [
        document.getElementById("recent-sort"),
        document.getElementById("favorite-sort"),
        document.getElementById("trending-sort")
    ];

    for (const option of sortOptions) {
        if (sort === option.innerText.toLowerCase()) {
            switchSort(option);
        }
        option.addEventListener("click", () => {
            sort = option.innerText.toLowerCase();
            switchSort(option);
        });
    }

    setDelayedTypeable(searchInput, () => {
        if (query === searchInput.value)
            return;

        query = searchInput.value;
        loadPage();
    });
}