import { EventManager } from "./event";
import { getCookies } from "./util";
import { ValidMod } from "./constants";

export type MappoolSortType = "recent" | "favorites" | "trending";

export interface User {
    id: number;
    username: string;
    avatar: string;
    cover: string;
}

export interface BeatmapsetMetadata {
    id: number;
    artist: string;
    title: string;
    creator: string;
}

export interface BeatmapMetadata {
    id: number;
    difficulty: string;
    ar: number;
    od: number;
    cs: number;
    hp: number;
    length: number;
    bpm: number;
}

export interface Mod {
    acronym: string;
    settings: Object | null;
}

export interface MappoolBeatmap {
    beatmapset_metadata: BeatmapsetMetadata;
    beatmap_metadata: BeatmapMetadata;
    mods: Mod[];
    star_rating: number;
}

export interface MappoolBeatmapConnection {
    slot: string;
    beatmap: MappoolBeatmap;
}

export interface Mappool {
    id: number;
    name: string;
    submitted_by_id: number;
    avg_star_rating: number;
}

export interface MappoolExtended extends Mappool {
    beatmap_connections: MappoolBeatmapConnection[];
    submitted_by: User;
    is_favorited?: boolean;
}

export interface MappoolWithFavorites extends Mappool {
    favorite_count: number;
}

export interface MappoolsResponse {
    data: MappoolWithFavorites[];
    total_pages: number;
}

export interface MappoolBeatmapPayload {
    id: number;
    slot: string;
    mods: ValidMod[];
}

export interface MappoolPayload {
    id?: number;
    name: string;
    beatmaps: MappoolBeatmapPayload[];
}

export interface SessionData {
    user: User | null;
}

export interface Tournament {
    id: number;
    name: string;
    abbreviation: string;
    description: string;
    link: string;
    submitted_by_id: number;
}

export interface TournamentInvolvement {
    roles: number;
    user: User;
}

export interface MappoolConnection {
    mappool_id: number;
    name_override: string | null;
    mappool: MappoolWithFavorites;
}

export interface TournamentExtended extends Tournament {
    staff: TournamentInvolvement[];
    mappools: Mappool;
    submitted_by: User;
    mappool_connections: MappoolConnection[];
    is_favorited?: boolean;
}

export interface TournamentWithFavorites extends Tournament {
    favorite_count: number;
}

export interface TournamentsResponse {
    data: TournamentWithFavorites[];
    total_pages: number;
}

export interface TournamentStaffPayload {
    id: number;
    roles: number;
}

export interface TournamentMappoolPayload {
    id: number;
    name_override: string | null;
}

export interface TournamentPayload {
    id?: number;
    name: string;
    abbreviation: string;
    description: string;
    link: string;
    staff: TournamentStaffPayload[];
    mappools: TournamentMappoolPayload[];
}

export class APIManager {
    public session: SessionData;

    private eventManager: EventManager;

    public constructor(eventManager: EventManager) {
        this.eventManager = eventManager;

        this.session = JSON.parse(document.getElementById("data").textContent);
    }

    /**
     * Make a request to the api
     * 
     * @param path - api path, excluding "api/"
     * @param init - config for the request
     * @returns json data or null if success, otherwise undefined
     */
    public async req(path: string, init: RequestInit | undefined = undefined): Promise<any> {
        if (init !== undefined && ["POST", "DELETE"].includes(init.method)) {
            const cookies = getCookies();
            init.headers = {
                ...init.headers,
                "X-CSRFToken": cookies.csrftoken
            }
        }

        const resp = await fetch(`/api/${path}`, init);

        if (!resp.ok) {
            try {
                const data = await resp.json();
                this.eventManager.error(data.error);
            } catch {
                this.eventManager.error(`Request failed with http error ${resp.status}`);
            }

            return undefined;
        }

        return await resp.json().catch(() => null);
    }

    /**
     * Get mappool data
     * 
     * @param id - Id of mappool
     * @returns mappool data if success, otherwise undefined
     */
    public async getMappool(id: number): Promise<MappoolExtended | undefined> {
        return await this.req(`mappools/${id}/`);
    }

    /**
     * Get list of mappools by page and sort
     * 
     * @param page - page to index
     * @param sort - sort to index by
     * @returns mappools and total pages if success, otherwise undefined
     */
    public async getMappools(page: number, sort: MappoolSortType): Promise<MappoolsResponse | undefined> {
        return await this.req(`mappools/?s=${sort}&p=${page}`);
    }

    /**
     * Create a new mappool
     * 
     * @param data - mappool data in the format of `MappoolPayload`
     * @returns mappool data if success, otherwise undefined
     */
    public async newMappool(data: MappoolPayload): Promise<Mappool | undefined> {
        return await this.req("mappools/", {
            method: "POST",
            body: JSON.stringify(data),
            credentials: "include"
        });
    }

    /**
     * Delete a mappool by id
     * 
     * @param id - mappool to delete
     * @returns null if success, otherwise undefined
     */
    public async deleteMappool(id: number): Promise<null | undefined> {
        return await this.req(`mappools/${id}/`, {
            method: "DELETE",
            credentials: "include"
        });
    }

    /**
     * Favorite or unfavorite a mappool
     * 
     * @param id - id of mappool to favorite
     * @param favorite - true to favorite or false to unfavorite
     * @returns null if success, otherwise undefined
     */
    public async favoriteMappool(id: number, favorite: boolean): Promise<null | undefined> {
        return await this.req(`mappools/${id}/favorite/`, {
            method: "POST",
            body: JSON.stringify({ "favorite": favorite }),
            credentials: "include"
        });
    }

    /**
     * Create a new tournament
     * 
     * @param data - tournament data in the form of `TournamentPayload`
     * @returns tournamnet data if success, otherwise undefined
     */
    public async newTournament(data: TournamentPayload): Promise<Tournament | undefined> {
        return await this.req("tournaments/", {
            method: "POST",
            body: JSON.stringify(data),
            credentials: "include"
        });
    }

    /**
     * Get tournament data
     * 
     * @param id - Id of tournament
     * @returns tournament data if success, otherwise undefined
     */
    public async getTournament(id: number): Promise<TournamentExtended | undefined> {
        return await this.req(`tournaments/${id}/`);
    }

    /**
     * Get list of tournaments by page
     * 
     * @param page - page to index
     * @returns list of tournaments and total pages if success, otherwise undefined
     */
    public async getTournaments(page: number): Promise<TournamentsResponse | undefined> {
        return await this.req(`tournaments/?p=${page}`);
    }

    /**
     * Delete a tournament by id
     * 
     * @param id - tournament to delete
     * @returns null if success, otherwise undefined
     */
    public async deleteTournament(id: number): Promise<null | undefined> {
        return await this.req(`tournaments/${id}/`, {
            method: "DELETE",
            credentials: "include"
        });
    }

    /**
     * Favorite/unfavorite a tournament
     * 
     * @param id - tournament id
     * @param favorite - whether to favorite or unfavorite
     * @returns null if success, otherwise undefined
     */
    public async favoriteTournament(id: number, favorite: boolean): Promise<null | undefined> {
        return await this.req(`tournaments/${id}/favorite/`, {
            method: "POST",
            body: JSON.stringify({ "favorite": favorite }),
            credentials: "include"
        });
    }

    /**
     * Get a user by id
     *
     * @param id - user's id
     */
    public async getUser(id: number): Promise<User | undefined> {
        return await this.req(`users/${id}/`);
    }
}