import jsx from "../jsxFactory";
import {getElementByIdOrThrow, removeChildren} from "../common/util";
import {ListingSortType} from "../common/api";
import {createPageNavigator, onPageClick} from "../common/navigation";
import {setDelayedTypeable} from "../common/interactions";
import {ElementsManager} from "../common/elements";

const manager = new ElementsManager();

export function createListingItem(id: number, title: string, favoriteCount: number, dbName: string, extra: null | string = null) {
    return (
        <div class="listing-item-container">
            <a href={`/db/${dbName}/${id}`} style="flex-grow: 1;">
                <p class="listing-item-title">{title}</p>
            </a>
            <hr></hr>
            <div class="listing-item-info">
                <img class="favorites-cnt-star" src="/static/assets/svg/favorites.svg"></img>
                <p class="listing-item-info-data">{favoriteCount.toString()}</p>
                <div style="flex-grow: 1;"></div>
                {extra  === null ? "" : <p class="listing-item-info-data right">{extra}</p>}
            </div>
        </div>
    );
}

export function createListing<T>(
    listingContainer: HTMLElement,
    getData: (page: number, sort: ListingSortType, query: string) => Promise<{data: T[], total_pages: number}>,
    createListingItem: (item: T) => Element
) {
    const params = new URLSearchParams(window.location.search);
    let sort: string = params.get("s") ?? "recent";
    let page: number = parseInt(params.get("p") ?? "1");
    let query: string = params.get("q") ?? "";
    let currentSortElm = null;

    const loadingText = getElementByIdOrThrow("loading-text");
    const searchInput = getElementByIdOrThrow<HTMLInputElement>("search-input");

    searchInput.value = query;

    function loadPage() {
        window.history.replaceState({ s: sort, p: page }, document.title, `?s=${sort}&p=${page}&q=${query}`);

        removeChildren(listingContainer);

        loadingText.classList.remove("hidden");

        getData.bind(manager.api)(page, sort as ListingSortType, query).then((resp: {data: T[], total_pages: number}) => {
            loadingText.classList.add("hidden");

            if (resp === undefined) {
                manager.event.error("Failed to load listing... try refreshing");
                return;
            }

            listingContainer.append(...resp.data.map(createListingItem));
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
        document.getElementById("favorites-sort"),
        document.getElementById("trending-sort")
    ];

    for (const option of sortOptions) {
        if (sort === option.id.split("-")[0]) {
            switchSort(option);
        }
        option.addEventListener("click", () => {
            sort = option.id.split("-")[0];
            switchSort(option);
        });
    }

    setDelayedTypeable(searchInput, () => {
        if (query === searchInput.value)
            return;

        query = searchInput.value;
        page = 1;
        loadPage();
    });
}