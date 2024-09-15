import {ElementsManager} from "../common/elements";
import {
    MappoolWithFavorites,
    Tournament,
    TournamentWithFavorites,
    User,
    UserExtended,
    UserTournamentInvolvement
} from "../common/api";
import {getElementByIdOrThrow, parseRolesFlag} from "../common/util";
import jsx from "../jsxFactory";
import {ROLES_SORT} from "../common/constants";
import {createListingItem} from "../database/listing";
import {createTournamentItem} from "../database/tournaments";
import {createMappoolItem} from "../database/mappools";

const manager = new ElementsManager();

function createUserInfo(user: User) {
    return (
        <div class="user-info-container">
            <img class="user-info-avatar" src={user.avatar}></img>
            <p class="user-info-username">{user.username}</p>
            <a href={`https://osu.ppy.sh/u/${user.id}`} target="_blank" class="user-external-link">
                <img src="/static/assets/svg/external-link.svg" class="user-external-link"></img>
            </a>
        </div>
    );
}

function createUserStaffRole(staffRole: UserTournamentInvolvement) {

    return (
        <div class="user-role-container">
            {staffRole.tournament.name}
        </div>
    );
}

function createUserConnections(user: UserExtended) {
    const container = <div class="user-roles-container"></div>;

    function addTournamentSection(title: string, tournaments: TournamentWithFavorites[]) {
        container.append(<h2>{title}</h2>);
        container.append(
            <div class="listing-container left">
                {tournaments.map(createTournamentItem)}
            </div>
        );
    }

    function addMappoolSection(title: string, mappools: MappoolWithFavorites[]) {
        container.append(<h2>{title}</h2>);
        container.append(
            <div class="listing-container left">
                {mappools.map(createMappoolItem)}
            </div>
        );
    }

    container.append(<h1>Favorites</h1>);

    if (user.tournament_favorites.length > 0)
        addTournamentSection("Tournament favorites", user.tournament_favorites.map((f) => f.tournament));

    if (user.mappool_favorites.length > 0)
        addMappoolSection("Mappool favorites", user.mappool_favorites.map((f) => f.mappool));

    container.append(<h1>Staffing roles</h1>);

    const roles: { [key: string]: TournamentWithFavorites[] } = {};
    for (const staffRole of user.staff_roles) {
        for (const role of parseRolesFlag(staffRole.roles)) {
            if (roles[role] === undefined)
                roles[role] = [];

            roles[role].push(staffRole.tournament);
        }
    }

    const sortedEntries = Object.entries(roles).sort(
        (a, b) => ROLES_SORT.indexOf(a[0]) - ROLES_SORT.indexOf(b[0])
    );
    for (const [role, tournaments] of sortedEntries)
        addTournamentSection(role, tournaments);

    return container;
}

export function userSetup() {
    const userId = parseInt(window.location.toString().split("/")[4]);
    const page = getElementByIdOrThrow("page");

    function createUserPage(user: UserExtended) {
        document.title += " "+user.username;

        page.append(
            createUserInfo(user),
            createUserConnections(user)
        );
    }

    manager.api.getUser(userId).then(createUserPage);
}