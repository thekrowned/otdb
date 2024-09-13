import {ElementsManager} from "../common/elements";
import {User} from "../common/api";

const manager = new ElementsManager();

export function userSetup() {
    const userId = parseInt(window.location.toString().split("/")[4]);

    function createUserPage(user: User) {
        document.title += " "+user.username;
    }

    manager.api.getUser(userId).then(createUserPage);
}