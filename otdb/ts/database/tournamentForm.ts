import { ElementsManager } from "../common/elements";
import { TextButton, TextDropdown, TextInput } from "../common/form";
import { getElementByIdOrThrow } from "../common/util";
import {ROLES_SORT, VALID_ROLES} from "../common/constants";
import { TournamentExtended } from "../common/api";

const manager = new ElementsManager();

export function tournamentFormSetup(editing: boolean) {
    const usersSection = getElementByIdOrThrow("users-section");
    const nameInput = manager.inputs.getRequired<TextInput>("name-input");
    const abbrInput = manager.inputs.getRequired<TextInput>("abbreviation-input");
    const linkInput = manager.inputs.getRequired<TextInput>("link-input");
    const descriptionInput = manager.inputs.getRequired<TextInput>("description-input");
    const addUser = manager.inputs.getRequired<TextButton>("add-user");
    const addMappool = manager.inputs.getRequired<TextButton>("add-mappool");
    const staffLabel = getElementByIdOrThrow("staff-label");

    nameInput.resize(300);
    abbrInput.resize(200);
    descriptionInput.resize(300);

    function onSubmit() {
        manager.inputs.submit.disable();

        const userIds = manager.inputs.query<TextInput>("user-id-input-");
        const roles = manager.inputs.query<TextDropdown>("roles-input-");
        const mappoolIds = manager.inputs.query<TextInput>("mappool-id-input-");
        const nameOverrides = manager.inputs.query<TextInput>("name-override-id-input-");

        manager.api.newTournament({
            id: tournamentData?.id,
            name: nameInput.getValue(),
            abbreviation: abbrInput.getValue(),
            link: linkInput.getValue(),
            description: descriptionInput.getValue(),
            staff: userIds.map((userId, i) => ({
                id: parseInt(userId.getValue()),
                roles: roles[i].getValues().map((value) => VALID_ROLES.indexOf(value)).reduce((t, i) => t + (1 << i), 0)
            })),
            mappools: mappoolIds.map((mappoolId, i) => ({
                id: parseInt(mappoolId.getValue()),
                name_override: nameOverrides[i].getValue() === "" ? null : nameOverrides[i].getValue()
            }))
        }).then((data) => {
            if (data === undefined) {
                manager.inputs.submit.enable();
            } else {
                window.location.replace(`/db/tournaments/${data.id}/`);
            }
        });
    }

    var idIncrement = 0;

    function addUserInputs(): {userId: TextInput, roles: TextDropdown} {
        const inputContainer = document.createElement("div");
        inputContainer.classList.add("input-container", "prevent-select");
    
        const userIdInput = manager.inputs.create<TextInput>(`user-id-input-${idIncrement}`, {
            type: "text",
            label: "User ID",
            validation: "uint",
            required: true
        }, inputContainer);
        userIdInput.resize(150);

        const rolesInput = manager.inputs.create<TextDropdown>(`roles-input-${idIncrement}`, {
            type: "text-dropdown",
            label: "Roles",
            options: ROLES_SORT,
            multi: true
        }, inputContainer);
        rolesInput.resize(300);

        const removeBtn = manager.inputs.create<TextButton>(`remove-beatmap-btn-${idIncrement}`, {
            type: "button",
            label: "-",
            danger: true,
            square: true
        }, inputContainer);
        removeBtn.addCallback(() => {
            manager.inputs.remove(userIdInput.id);
            manager.inputs.remove(rolesInput.id);
            manager.inputs.remove(removeBtn.id);
            inputContainer.remove();
        });
    
        idIncrement += 1;
    
        usersSection.insertBefore(inputContainer, manager.inputs.submit.getParentContainer());

        return {
            userId: userIdInput,
            roles: rolesInput
        };
    }

    var mappoolIdIncrement = 0;

    function addMappoolInputs(): {mappoolId: TextInput, nameOverride: TextInput} {
        const inputContainer = document.createElement("div");
        inputContainer.classList.add("input-container", "prevent-select");

        const mappoolIdInput = manager.inputs.create<TextInput>(`mappool-id-input-${mappoolIdIncrement}`, {
            type: "text",
            label: "Mappool ID",
            validation: "uint",
            required: true
        }, inputContainer);

        const nameOverrideInput = manager.inputs.create<TextInput>(`name-override-id-input-${mappoolIdIncrement}`, {
            type: "text",
            label: "Name override"
        }, inputContainer);

        const removeBtn = manager.inputs.create<TextButton>(`remove-beatmap-btn-${idIncrement}`, {
            type: "button",
            label: "-",
            danger: true,
            square: true
        }, inputContainer);

        removeBtn.addCallback(() => {
            manager.inputs.remove(mappoolIdInput.id);
            manager.inputs.remove(nameOverrideInput.id);
            manager.inputs.remove(removeBtn.id);
            inputContainer.remove();
        });

        mappoolIdIncrement += 1;

        usersSection.insertBefore(inputContainer, staffLabel);

        return {
            mappoolId: mappoolIdInput,
            nameOverride: nameOverrideInput
        };
    }

    addMappool.addCallback(addMappoolInputs);
    addUser.addCallback(addUserInputs);
    manager.inputs.submit.addCallback(onSubmit);

    var tournamentData: TournamentExtended | null = null;

    if (editing) {
        tournamentData = JSON.parse(getElementByIdOrThrow("tournament-data").innerText);

        nameInput.setValue(tournamentData.name);
        abbrInput.setValue(tournamentData.abbreviation);
        linkInput.setValue(tournamentData.link);
        descriptionInput.setValue(tournamentData.description);

        for (const staff of tournamentData.staff) {
            const inputs = addUserInputs();
            inputs.userId.setValue(staff.user.id.toString());
            for (const item of inputs.roles.items) {
                if ((1 << VALID_ROLES.indexOf(item.getLabel())) & staff.roles) {
                    item.pick();
                }
            }
        }

        for (const conn of tournamentData.mappool_connections) {
            const inputs = addMappoolInputs();
            inputs.mappoolId.setValue(conn.mappool_id.toString());
            if (conn.name_override !== null)
                inputs.nameOverride.setValue(conn.name_override);
        }
    }
}