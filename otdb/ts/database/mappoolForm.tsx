import { ElementsManager } from '../common/elements';
import { TextInput, TextButton, TextDropdown } from '../common/form';
import {askBeforeLeaving, getElementByIdOrThrow} from '../common/util';
import { MappoolPayload, MappoolBeatmapPayload, MappoolExtended } from "../common/api";
import { ValidMod, VALID_MODS } from '../common/constants';
import jsx from "../jsxFactory";

const manager = new ElementsManager();

function getMappoolBeatmaps(): Array<MappoolBeatmapPayload> {
    const mappoolBeatmaps: Array<MappoolBeatmapPayload> = [];

    const idInputs = manager.inputs.query<TextInput>("beatmap-id-input-");
    const slotInputs = manager.inputs.query<TextInput>("slot-input-");
    const modInputs = manager.inputs.query<TextDropdown>("mods-input-");

    for (let i=0; i<idInputs.length; i++) {
        const idInput = idInputs[i] as TextInput;
        const slotInput = slotInputs[i] as TextInput;
        const modInput = modInputs[i] as TextDropdown;

        mappoolBeatmaps.push({
            id: parseInt(idInput.getValue()),
            slot: slotInput.getValue(),
            mods: modInput.getValues() as ValidMod[]
        });
    }

    return mappoolBeatmaps;
}

export function mappoolFormSetup(editing: boolean) {
    const nameInput = manager.inputs.getRequired<TextInput>("name-input");
    const descriptionInput = manager.inputs.getRequired<TextInput>("description-input");
    const addBeatmapBtn = manager.inputs.getRequired<TextButton>("add-beatmap");
    const openQuickAddBtn = manager.inputs.getRequired<TextButton>("quick-add-beatmaps");

    const beatmapSection: HTMLElement = getElementByIdOrThrow("beatmap-section");

    let idIncrement = 1;

    function onOpenQuickAdd() {
        manager.popup.open();
    }
    
    function onCloseQuickAdd() {
        manager.popup.close();
    }
    
    function deleteCurrentInputs() {
        for (const btn of manager.inputs.query<TextButton>("remove-beatmap-btn-")) {
            btn.click();
        }
    }
    
    function onQuickAddBeatmaps() {
        deleteCurrentInputs();

        const beatmapIds = quickAddBeatmapsInput.getValue().split("\n");
        const beatmapSlots = quickAddSlotsInput.getValue().split("\n");
        if (beatmapIds.length != beatmapSlots.length || beatmapIds.length == 0) {
            return;
        }
    
        for (let i=0; i<beatmapIds.length; i++) {
            const inputs = addBeatmap();
            inputs.id.setValue(beatmapIds[i]);
            inputs.slot.setValue(beatmapSlots[i]);
    
            const slot = beatmapSlots[i].toUpperCase();
            for (let sI=0; sI<slot.length-1; sI+=2) {
                const possibleMod = slot.substring(sI, sI+2);
                const mod = inputs.mods.getItem(possibleMod === "TB" ? "FM" : possibleMod);
                if (mod !== null) {
                    mod.pick();
                }
            }
        }
    
        quickAddBeatmapsInput.setValue("");
        quickAddSlotsInput.setValue("");
        onCloseQuickAdd();
    }

    let disableLeavePrompt = false;

    function onSubmitBeatmaps() {
        manager.inputs.submit.disable();
        document.body.style.cursor = "wait";
    
        const data: MappoolPayload = {
            id: mappoolData?.id,
            name: nameInput.getValue(),
            description: descriptionInput.getValue(),
            beatmaps: getMappoolBeatmaps()
        };
        manager.api.newMappool(data).then(
            (data) => {
                if (data === undefined) {
                    manager.inputs.submit.enable();
                    document.body.style.cursor = "default";
                } else {
                    disableLeavePrompt = true;
                    window.location.replace(`/db/mappools/${data.id}/`);
                }
            }
        );
    }

    function addBeatmap(): {id: TextInput, slot: TextInput, mods: TextDropdown} {
        const inputContainer = document.createElement("div");
        inputContainer.classList.add("input-container", "prevent-select");
    
        const beatmapIdInput = manager.inputs.create<TextInput>(`beatmap-id-input-${idIncrement}`, {
            type: "text",
            label: "Beatmap ID",
            validation: "uint",
            required: true
        }, inputContainer);
        beatmapIdInput.resize(150);

        const slotInput = manager.inputs.create<TextInput>(`slot-input-${idIncrement}`, {
            type: "text",
            label: "Slot",
            validation: "any",
            required: true,
            "max-length": 8
        }, inputContainer);
        slotInput.resize(100);

        const modsInput = manager.inputs.create<TextDropdown>(`mods-input-${idIncrement}`, {
            type: "text-dropdown",
            label: "Mods",
            options: VALID_MODS,
            multi: true
        }, inputContainer);
        modsInput.resize(150);

        const removeBtn = manager.inputs.create<TextButton>(`remove-beatmap-btn-${idIncrement}`, {
            type: "button",
            label: "-",
            danger: true,
            square: true
        }, inputContainer);
        removeBtn.addCallback(() => {
            manager.inputs.remove(beatmapIdInput.id);
            manager.inputs.remove(slotInput.id);
            manager.inputs.remove(modsInput.id);
            manager.inputs.remove(removeBtn.id);
            inputContainer.remove();
        });
    
        idIncrement += 1;
    
        beatmapSection.insertBefore(inputContainer, manager.inputs.submit.getParentContainer());
    
        return {id: beatmapIdInput, slot: slotInput, mods: modsInput};
    }

    const quickAddBeatmapsInput = manager.inputs.create<TextInput>("quick-add-beatmaps", {
        type: "text",
        label: "Beatmap IDs",
        innerStyle: "width: calc(100% - 13px);",
        textarea: true
    }, null);
    const quickAddSlotsInput = manager.inputs.create<TextInput>("quick-add-slots", {
        type: "text",
        label: "Slots",
        innerStyle: "width: calc(100% - 13px);",
        textarea: true
    }, null);
    const quickAddBeatmapsBtn = manager.inputs.create<TextButton>("quick-add-beatmaps", {
        type: "button",
        label: "Add beatmaps",
    }, null);

    manager.popup.setPromptCustom(
        <p class="description">Input line-separated list of values</p>,
        <p class="description" style="font-size: 15px">Hint: you can copy-paste directly from a google sheet</p>,
        quickAddBeatmapsInput.elm,
        quickAddSlotsInput.elm,
        <div class="input-container prevent-select">
            {quickAddBeatmapsBtn.elm}
        </div>
    );

    addBeatmapBtn.addCallback(() => addBeatmap());
    openQuickAddBtn.addCallback(onOpenQuickAdd);
    quickAddBeatmapsBtn.addCallback(onQuickAddBeatmaps);
    manager.inputs.submit.addCallback(onSubmitBeatmaps);
    manager.backdrop.addCallback(onCloseQuickAdd);

    askBeforeLeaving(() => !disableLeavePrompt);

    var mappoolData: null | MappoolExtended = null;

    if (!editing) {
        addBeatmap();
    } else {
        mappoolData = JSON.parse(getElementByIdOrThrow("mappool-data").innerText) as MappoolExtended;
        nameInput.setValue(mappoolData.name);
        for (const connection of mappoolData.beatmap_connections) {
            const beatmap = connection.beatmap;

            const bmInputs = addBeatmap();
            bmInputs.slot.setValue(connection.slot);
            bmInputs.id.setValue(beatmap.beatmap_metadata.id.toString());
            for (const mod of beatmap.mods) {
                for (const item of bmInputs.mods.items) {
                    if (item.label === mod.acronym) {
                        item.pick();
                        break;
                    }
                }
            }
        }
    }
}