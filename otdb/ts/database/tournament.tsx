import {
    MappoolConnection,
    TournamentExtended,
    TournamentInvolvement,
    TournamentInvolvementExtended,
    User
} from "../common/api";
import { ElementsManager } from "../common/elements";
import {escapeHtml, getElementByIdOrThrow} from "../common/util";
import { ROLES_SORT, VALID_ROLES } from "../common/constants";
import jsx from "../jsxFactory";
import { setHoldClick } from "../common/interactions";
import { createListingItem } from "./listing";

const manager = new ElementsManager();

function * getRoles(roles: number): Generator<string> {
    for (const [i, role] of VALID_ROLES.entries()) {
        if (roles & (1 << i)) {
            yield role;
        }
    }
}

export function tournamentSetup() {
    const tournamentName = getElementByIdOrThrow("tournament-name");
    const container = getElementByIdOrThrow("tournament-container");
    const favoriteBtn = getElementByIdOrThrow("favorite-btn");
    const favoriteSvg = favoriteBtn.children.item(0) as SVGElement;
    const editBtn = getElementByIdOrThrow("edit-btn");
    const deleteBtn = getElementByIdOrThrow("delete-btn");

    const tournamentId = parseInt(window.location.toString().split("/")[5]);

    var favoriteDebounce = false;
    var deleteDebounce = false;

    function favoriteTournament() {
        if (favoriteDebounce) return;
        favoriteDebounce = true;
        
        const favorite = favoriteSvg.getAttribute("fill") === "none";
        manager.api.favoriteTournament(
            tournamentId,
            favorite,
        ).then((resp) => {
            favoriteDebounce = false;
            if (resp === null) {
                favoriteSvg.setAttribute("fill", favorite ? "white":"none");
            }
        });
    }

    function deleteTournament() {
        deleteDebounce = true;
    
        manager.api.deleteTournament(tournamentId).then((resp) => {
            if (resp === null) {
                window.location.replace(`/db/tournaments/`);
                return;
            }
            deleteDebounce = false;
        });
    }

    function createTournamentItem(label: string, value: string, link=false) {
        if (!link)
            return <p class="tournament-item">
                <span class="tournament-item-label">{label}: </span>
                {escapeHtml(value)}
            </p>;
        else
            return <p class="tournament-item">
                <span class="tournament-item-label">{label}: </span>
                <a href={value} target="_blank">{escapeHtml(value)}</a>
            </p>;
    }

    function createStaff(staff: TournamentInvolvementExtended[]) {
        const staffRoles: {[_: string]: User[]} = {};
        for (const involvement of staff) {
            for (const role of getRoles(involvement.roles)) {
                if (staffRoles[role] === undefined) {
                    staffRoles[role] = [];
                }

                staffRoles[role].push(involvement.user);
            }
        }

        container.append(<h1 class="tournament-section-label">Staff</h1>);
        for (const [role, users] of Object.entries(staffRoles).sort((a, b) => ROLES_SORT.indexOf(a[0]) - ROLES_SORT.indexOf(b[0]))) {
            container.append(
                <h1 class="tournament-section-label sub">{role}</h1>,
                <div class="tournament-staff-container">
                    {users.map((user) => <a href={`/users/${user.id}`}>
                        <div class="tournament-staff">
                            <img class="tournament-staff-avatar" src={user.avatar}></img>
                            {escapeHtml(user.username)}
                        </div>
                    </a>)}
                </div>
            );
        }
    }

    function createMappools(mappools: MappoolConnection[]) {
        container.append(
            <h1 class="tournament-section-label">Mappools</h1>,
            <div class="listing-container left">{mappools.map((conn) => createListingItem(
                conn.mappool.id,
                conn.name_override ?? conn.mappool.name,
                conn.mappool.favorite_count,
                "mappools",
                (Math.floor(conn.mappool.avg_star_rating * 100) / 100).toString() + "★"
            ))}</div>
        );
        
    }

    function createTournament(data: TournamentExtended | undefined) {
        if (data === undefined)
            return;

        if (manager.api.session.user !== null) {
            favoriteBtn.classList.remove("hidden");
            favoriteSvg.setAttribute("fill", data.is_favorited ? "white":"none");
            
            if (data.submitted_by_id === manager.api.session.user.id || manager.api.session.user.is_admin) {
                editBtn.classList.remove("hidden");
                deleteBtn.classList.remove("hidden");
            }
        }

        document.title += `: ${data.abbreviation}`;
        tournamentName.innerHTML = data.name;

        if (data.link.length > 0)
            container.append(createTournamentItem("Link", data.link, true));

        if (data.description.length > 0)
            container.append(createTournamentItem("Description", data.description));

        if (data.mappool_connections.length > 0)
            createMappools(data.mappool_connections);

        if (data.staff.length > 0)
            createStaff(data.staff);
    }

    favoriteBtn.addEventListener("click", favoriteTournament);
    editBtn.addEventListener("click", () => {
        window.location.href = window.location.href+"edit";
    });
    setHoldClick(deleteBtn, deleteTournament);

    manager.api.getTournament(tournamentId).then(createTournament);
}