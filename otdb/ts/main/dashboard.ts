import {getElementByIdOrThrow} from "../common/util";
import {setHoldClick} from "../common/interactions";

export function dashboardSetup() {
    const logoutBtn = getElementByIdOrThrow("logout-btn");

    let loggingOut = false;

    function onLogout() {
        if (loggingOut)
            return;

        loggingOut = true;
        window.location.replace("/logout");
    }

    setHoldClick(logoutBtn, onLogout);
}