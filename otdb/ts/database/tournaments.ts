import { getElementByIdOrThrow } from "../common/util";
import {createListing, createListingItem} from "./listing";
import {APIManager, TournamentWithFavorites} from "../common/api";

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

    createListing<TournamentWithFavorites>(tournamentContainer, APIManager.prototype.getTournaments, createTournamentItem);
}