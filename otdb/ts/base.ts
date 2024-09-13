import {getElementByIdOrThrow} from "./common/util";
import {ElementsManager} from "./common/elements";

const manager = new ElementsManager();

export function baseSetup() {
    const avatar = document.getElementById("login-avatar");
    const dropdown = getElementByIdOrThrow("login-dropdown");
    const dashboardItem = getElementByIdOrThrow("dashboard-item");
    const profileItem = getElementByIdOrThrow("profile-item");

    avatar.addEventListener("click", () => {
        if (dropdown.classList.contains("active"))
            dropdown.classList.remove("active");
        else
            dropdown.classList.add("active");
    });
    window.addEventListener("click", (evt) => {
        if (evt.target != avatar && evt.target != dropdown)
            dropdown.classList.remove("active");
    });

    dashboardItem.addEventListener("click", () => window.location.assign("/dashboard"));
    profileItem.addEventListener("click", () => window.location.assign(`/users/${manager.api.session.user.id}`));
}