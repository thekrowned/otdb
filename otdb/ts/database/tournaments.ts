import { ElementsManager } from "../common/elements";
import { createPageNavigator, onPageClick } from "../common/navigation";
import { getElementByIdOrThrow, removeChildren } from "../common/util";
import { createListingItem } from "./listing";
import {setDelayedTypeable} from "../common/interactions";
import {ListingSortType} from "../common/api";

const manager = new ElementsManager();

export function tournamentsSetup() {
    const params = new URLSearchParams(window.location.search);
    var sort: string = params.get("s") ?? "recent";
    var page: number = parseInt(params.get("p") ?? "1");
    let query: string = params.get("q") ?? "";
    var currentSortElm = null;

    const loadingText = getElementByIdOrThrow("loading-text");
    const tournamentContainer = getElementByIdOrThrow("tournaments-container");
    const searchInput = getElementByIdOrThrow<HTMLInputElement>("search-input");

    function loadPage() {
        window.history.replaceState({ s: sort, p: page }, document.title, `?s=${sort}&p=${page}&q=${query}`);

        removeChildren(tournamentContainer);

        loadingText.classList.remove("hidden");

        manager.api.getTournaments(page, sort as ListingSortType, query).then((resp) => {
            loadingText.classList.add("hidden");

            if (resp === undefined) {
                manager.event.error("Failed to load tournaments... try refreshing");
                return;
            }

            tournamentContainer.append(...resp.data.map(
                (tournament) => createListingItem(tournament.id, tournament.name, tournament.favorite_count, "tournaments")
            ));
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