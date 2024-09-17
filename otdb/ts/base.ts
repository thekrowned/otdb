import {getElementByIdOrThrow} from "./common/util";
import {ElementsManager} from "./common/elements";

const manager = new ElementsManager();

export function baseSetup() {
    const mobileHeader = getElementByIdOrThrow("mobile-header");
    const mobileHeaderDropdown = getElementByIdOrThrow("mobile-header-dropdown");
    const headerUpArrow = getElementByIdOrThrow("header-arrow-up");
    const headerDownArrow = getElementByIdOrThrow("header-arrow-down");

    const avatar = document.getElementById("login-avatar");
    const dropdown = getElementByIdOrThrow("login-dropdown");
    const dashboardItem = getElementByIdOrThrow("dashboard-item");
    const profileItem = getElementByIdOrThrow("profile-item");

    avatar?.addEventListener("click", () => {
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

    function toggleHeaderDropdown() {
        if (headerUpArrow.classList.contains("hidden")) {
            headerUpArrow.classList.remove("hidden");
            headerDownArrow.classList.add("hidden");
            mobileHeaderDropdown.classList.remove("hidden");
            manager.backdrop.show("header");
        } else {
            headerDownArrow.classList.remove("hidden");
            headerUpArrow.classList.add("hidden");
            mobileHeaderDropdown.classList.add("hidden");
            manager.backdrop.hide();
        }
    }

    mobileHeader.addEventListener("click", toggleHeaderDropdown);
    manager.backdrop.addCallback(() => {
        // if header open
        if (!mobileHeaderDropdown.classList.contains("hidden"))
            toggleHeaderDropdown();
    });
}