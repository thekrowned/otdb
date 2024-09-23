import { ElementsManager } from "../common/elements";
import {TextButton, TextDropdown, TextInput, TextSearch} from "../common/form";
import {getElementByIdOrThrow, parseRolesFlag} from "../common/util";
import {ROLES_SORT, VALID_ROLES} from "../common/constants";
import { TournamentExtended } from "../common/api";
import jsx from "../jsxFactory";

const manager = new ElementsManager();

export function tournamentFormSetup(editing: boolean) {
    const usersSection = getElementByIdOrThrow("users-section");
    const nameInput = manager.inputs.getRequired<TextInput>("name-input");
    const abbrInput = manager.inputs.getRequired<TextInput>("abbreviation-input");
    const linkInput = manager.inputs.getRequired<TextInput>("link-input");
    const descriptionInput = manager.inputs.getRequired<TextInput>("description-input");
    const addMappool = manager.inputs.getRequired<TextButton>("add-mappool");
    const staffLabel = getElementByIdOrThrow("staff-label");

    nameInput.resize(300);
    abbrInput.resize(200);
    descriptionInput.resize(300);

    function onSubmit() {
        manager.inputs.submit.disable();

        const userIds = manager.inputs.query<TextInput>("user-id-input-");
        const mappoolIds = manager.inputs.query<TextSearch<number>>("mappool-input-");
        const nameOverrides = manager.inputs.query<TextInput>("name-override-id-input-");

        const staff: {[id: string]: number} = {};
        for (const userId of userIds) {
            const id = userId.getValue();
            if (staff[id] === undefined) {
                staff[id] = 0;
            }

            const roleFlag = 1 << VALID_ROLES.indexOf(userId.id.split("-")[5]);
            if (staff[id] & roleFlag)
                continue;

            staff[id] += roleFlag;
        }

        manager.api.newTournament({
            id: tournamentData?.id,
            name: nameInput.getValue(),
            abbreviation: abbrInput.getValue(),
            link: linkInput.getValue(),
            description: descriptionInput.getValue(),
            staff: Object.entries(staff).map(
                ([id, roles]) => ({id: parseInt(id), roles: roles})
            ),
            mappools: mappoolIds.map((mappoolId, i) => ({
                id: mappoolId.getInnerValues()[0],
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

    function addUserInputs(role: string): {userId: TextInput, remove: TextButton} {
        const userIdInput = manager.inputs.create<TextInput>(`user-id-input-${idIncrement}-role-${role}`, {
            type: "text",
            label: "User ID",
            validation: "uint",
            required: true
        }, null);
        userIdInput.resize(150);

        const removeBtn = manager.inputs.create<TextButton>(`remove-user-btn-${idIncrement}`, {
            type: "button",
            label: "-",
            danger: true,
            square: true
        }, null);

        removeBtn.addCallback(() => {
            manager.inputs.remove(userIdInput.id).elm.remove();
            manager.inputs.remove(removeBtn.id).elm.remove();
        });
    
        idIncrement += 1;

        return {
            userId: userIdInput,
            remove: removeBtn
        };
    }

    var mappoolIdIncrement = 0;

    function addMappoolInputs(): {mappool: TextSearch<number>, nameOverride: TextInput} {
        const inputContainer = document.createElement("div");
        inputContainer.classList.add("input-container", "prevent-select");

        const mappoolInput = manager.inputs.create<TextSearch<number>>(`mappool-input-${mappoolIdIncrement}`, {
            type: "text-search",
            label: "Mappool",
            required: true,
            multi: false,
            options: []
        }, inputContainer);
        mappoolInput.bindSearch(async (query) => {
            const result = await manager.api.getMappools(1, "favorites", query);
            return result.data.map((m) => ({label: m.name, value: m.id}));
        });

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
            manager.inputs.remove(mappoolInput.id);
            manager.inputs.remove(nameOverrideInput.id);
            manager.inputs.remove(removeBtn.id);
            inputContainer.remove();
        });

        mappoolIdIncrement += 1;

        usersSection.insertBefore(inputContainer, staffLabel);

        return {
            mappool: mappoolInput,
            nameOverride: nameOverrideInput
        };
    }

    const roleInputContainers: {[role: string]: Element} = {};

    for (const role of ROLES_SORT) {
        const addInputBtn = manager.inputs.create<TextButton>(
            "add-user-" + role,
            {
                type: "button",
                label: "+",
                square: true
            },
            null
        );
        usersSection.appendChild(
            <div class="input-container prevent-select">
                {addInputBtn.elm}
                <h2>{role}</h2>
            </div>
        );
        const userInputContainer = usersSection.appendChild(
            <div class="input-container prevent-select"></div>
        );

        addInputBtn.addCallback(
            () => userInputContainer.append(...Object.values(addUserInputs(role)).map((i) => i.elm))
        );

        roleInputContainers[role] = userInputContainer;
    }

    addMappool.addCallback(addMappoolInputs);
    manager.inputs.submit.addCallback(onSubmit);

    var tournamentData: TournamentExtended | null = null;

    // fill in data
    if (editing) {
        tournamentData = JSON.parse(getElementByIdOrThrow("tournament-data").innerText);

        nameInput.setValue(tournamentData.name);
        abbrInput.setValue(tournamentData.abbreviation);
        linkInput.setValue(tournamentData.link);
        descriptionInput.setValue(tournamentData.description);

        for (const staff of tournamentData.staff) {
            for (const role of parseRolesFlag(staff.roles)) {
                const inputs = addUserInputs(role);
                roleInputContainers[role].append(inputs.userId.elm, inputs.remove.elm);
                inputs.userId.setValue(""+staff.user.id);
            }
        }

        for (const conn of tournamentData.mappool_connections) {
            const inputs = addMappoolInputs();
            const item = inputs.mappool.createItem(conn.mappool.name, conn.mappool_id);
            item.pick();
            if (conn.name_override !== null)
                inputs.nameOverride.setValue(conn.name_override);
        }
    }
}