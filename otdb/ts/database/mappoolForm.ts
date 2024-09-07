import { ElementsManager } from '../common/elements';
import { TextInput, TextButton, TextDropdown } from '../common/form';
import { getElementByIdOrThrow } from '../common/util';
import { MappoolPayload, MappoolBeatmapPayload, MappoolExtended } from "../common/api";
import { ValidMod, VALID_MODS } from '../common/constants';

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
    const quickAddBeatmapsInput = manager.inputs.getRequired<TextInput>("quick-add-beatmaps-input");
    const quickAddSlotsInput = manager.inputs.getRequired<TextInput>("quick-add-slots-input");
    const addBeatmapBtn = manager.inputs.getRequired<TextButton>("add-beatmap");
    const openQuickAddBtn = manager.inputs.getRequired<TextButton>("quick-add-beatmaps");
    const quickAddBeatmapsBtn = manager.inputs.getRequired<TextButton>("quick-add-beatmaps-btn");

    const beatmapSection: HTMLElement = getElementByIdOrThrow("beatmap-section");
    const quickAddContainer = getElementByIdOrThrow("quick-add-container");

    var idIncrement = 1;

    function onOpenQuickAdd(evt: MouseEvent) {
        manager.backdrop.show();
        quickAddContainer.classList.remove("hidden");
    }
    
    function onCloseQuickAdd(evt: MouseEvent | null = null) {
        manager.backdrop.hide();
        quickAddContainer.classList.add("hidden");
    }
    
    function deleteCurrentInputs() {
        for (const btn of manager.inputs.query<TextButton>("remove-beatmap-btn-")) {
            btn.click();
        }
    }
    
    function onQuickAddBeatmaps(evt: MouseEvent) {
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

    function onSubmitBeatmaps(evt: MouseEvent) {
        manager.inputs.submit.disable();
        document.body.style.cursor = "wait";
    
        const data: MappoolPayload = {
            id: mappoolData?.id,
            name: nameInput.getValue(),
            beatmaps: getMappoolBeatmaps()
        };
        manager.api.newMappool(data).then(
            (data) => {
                if (data === undefined) {
                    manager.inputs.submit.enable();
                    document.body.style.cursor = "default";
                } else {
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
        removeBtn.addCallback((evt) => {
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

    addBeatmapBtn.addCallback((evt: MouseEvent) => addBeatmap());
    openQuickAddBtn.addCallback(onOpenQuickAdd);
    quickAddBeatmapsBtn.addCallback(onQuickAddBeatmaps);
    manager.inputs.submit.addCallback(onSubmitBeatmaps);
    manager.backdrop.addCallback(onCloseQuickAdd);

    var mappoolData: null | MappoolExtended = null;

    if (!editing) {
        addBeatmap();
    } else {
        mappoolData = JSON.parse(getElementByIdOrThrow("mappool-data").innerText) as MappoolExtended;
        nameInput.setValue(mappoolData.name);
        for (const beatmap of mappoolData.beatmaps) {
            const bmInputs = addBeatmap();
            bmInputs.slot.setValue(beatmap.slot);
            bmInputs.id.setValue(beatmap.beatmap_metadata.id.toString());
            for (const mod of beatmap.mods) {
                for (const item of bmInputs.mods.items) {
                    if (item.getLabel() === mod.acronym) {
                        item.pick();
                        break;
                    }
                }
            }
        }
    }
}