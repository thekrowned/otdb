import {ElementsManager} from "../common/elements";
import {Tournament, TournamentWithFavorites, User, UserExtended, UserTournamentInvolvement} from "../common/api";
import {getElementByIdOrThrow, parseRolesFlag} from "../common/util";
import jsx from "../jsxFactory";
import {ROLES_SORT} from "../common/constants";
import {createListingItem} from "../database/listing";

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

function createUserStaffRoles(staffRoles: UserTournamentInvolvement[]) {
    const roles: { [key: string]: TournamentWithFavorites[] } = {};

    for (const staffRole of staffRoles) {
        for (const role of parseRolesFlag(staffRole.roles)) {
            if (roles[role] === undefined)
                roles[role] = [];

            roles[role].push(staffRole.tournament);
        }
    }

    const container = <div class="user-roles-container"></div>;

    const sortedEntries = Object.entries(roles).sort(
        (a, b) => ROLES_SORT.indexOf(a[0]) - ROLES_SORT.indexOf(b[0])
    );
    for (const [role, tournaments] of sortedEntries) {
        container.append(<h1>{role}</h1>);
        container.append(
            <div class="listing-container left">
                {tournaments.map((t) => createListingItem(
                    t.id,
                    t.name,
                    t.favorite_count,
                    "tournaments"
                ))}
            </div>
        );
    }

    return container;
}

export function userSetup() {
    const userId = parseInt(window.location.toString().split("/")[4]);
    const page = getElementByIdOrThrow("page");

    function createUserPage(user: UserExtended) {
        document.title += " "+user.username;

        page.append(
            createUserInfo(user),
            createUserStaffRoles(user.staff_roles)
        );
    }

    manager.api.getUser(userId).then(createUserPage);
}