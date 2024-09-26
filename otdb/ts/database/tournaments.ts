import { getElementByIdOrThrow } from "../common/util";
import {createListing, createListingItem} from "./listing";
import {APIManager, TournamentWithFavorites} from "../common/api";
import {ElementsManager} from "../common/elements";

const manager = new ElementsManager();

export function createTournamentItem(tournament: TournamentWithFavorites) {
    return createListingItem(
        tournament.id,
        tournament.name,
        tournament.favorite_count,
        "tournaments"
    );
}

export function tournamentsSetup() {
    const tournamentContainer = getElementByIdOrThrow("tournaments-container");

    const searchParams = new URLSearchParams();

    createListing<TournamentWithFavorites>(
        tournamentContainer,
        (params) => manager.api.getTournamentsFromParams(params),
        createTournamentItem,
        searchParams
    );
}