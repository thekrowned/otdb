import {getElementByIdOrThrow, formatLength, escapeHtml} from "../common/util";
import { ElementsManager } from "../common/elements";
import {BeatmapsetMetadata, MappoolExtended, MappoolBeatmap, MappoolBeatmapConnection} from "../common/api";
import { getStarRatingColor } from "../common/util";
import { setHoldClick } from "../common/interactions";

interface DifficultyAttribute {
    value: number | string;
    percentage?: number;
}

const manager = new ElementsManager();

function getSlotColor(slot: string): string {
    switch (slot.substring(0, 2).toUpperCase()) {
        case "NM":
            return "#4285f4";
        case "HD":
            return "#fbbc04";
        case "HR":
            return "#f24141";
        case "DT":
            return "#7b68ff";
        case "FM":
            return "#27d8cb";
        case "TB":
            return "#b24314";
        case "EZ":
            return "#1ed31d";
        default:
            return "#ffffff"
    }
}

function arToMs(ar: number): number {
    return 1200 + (ar >= 5 ? 750 : 600) * (5 - ar) / 5;
}

function msToAr(ms: number): number {
    return 5 - (ms - 1200) / (ms <= 1200 ? 750 : 600) * 5;
}

function odToMs(od: number): number {
    return 80 - 6 * od;
}

function msToOd(ms: number): number {
    return (80 - ms) / 6;
}

function getRealAttributes(beatmap: MappoolBeatmap): {
    cs: DifficultyAttribute,
    hp: DifficultyAttribute,
    od: DifficultyAttribute,
    ar: DifficultyAttribute,
    length: DifficultyAttribute,
    bpm: DifficultyAttribute
} {
    // TODO
    const mods: string[] = [];
    for (const mod of beatmap.mods) {
        mods.push(mod.acronym.toUpperCase());
    }

    var cs = beatmap.beatmap_metadata.cs;
    var hp = beatmap.beatmap_metadata.hp;
    var od = beatmap.beatmap_metadata.od;
    var ar = beatmap.beatmap_metadata.ar;
    var length = beatmap.beatmap_metadata.length;
    var bpm = beatmap.beatmap_metadata.bpm;

    var maxAr = 10;
    var maxOd = 10;

    if (mods.includes("HR")) {
        cs = Math.min(cs * 1.3, 10);
        hp = Math.min(hp * 1.4, 10);
        od = Math.min(od * 1.4, 10);
        ar = Math.min(ar * 1.4, 10);
    } else if (mods.includes("EZ")) {
        cs *= 0.5;
        hp *= 0.5;
        od *= 0.5;
        ar *= 0.5;
    }

    if (mods.includes("DT")) {
        ar = msToAr(arToMs(ar) * 2 / 3);
        od = msToOd(odToMs(od) * 2 / 3);
        maxAr = 11;
        maxOd = 11.11;
        length *= (2/3);
        bpm *= 1.5;
    } else if (mods.includes("HT")) {
        ar = msToAr(arToMs(ar)*4/3);
        od = msToOd(odToMs(od)*4/3);
        maxAr = 9;
        maxOd = 8.89;
        length *= (4/3);
        bpm *= 0.75;
    }

    return {
        cs: {
            value: Math.round(cs * 10) / 10,
            percentage: cs/10*100
        },
        hp: {
            value: Math.round(hp * 10) / 10,
            percentage: hp/10*100
        },
        od: {
            value: Math.round(od * 10) / 10,
            percentage: od/maxOd*100
        },
        ar: {
            value: Math.round(ar * 10) / 10,
            percentage: ar/maxAr*100
        },
        length: {
            value: Math.floor(length)
        },
        bpm: {
            value: Math.floor(bpm)
        }
    };
}

function createAttributeLabel(name: string, attributes: DifficultyAttribute, hasBar: boolean = true): HTMLDivElement {
    const container = document.createElement("div");
    container.classList.add("difficulty-metadata-row");

    const label = document.createElement("p");
    label.classList.add("difficulty-metadata-label");
    label.innerHTML = `${name} ${attributes.value}`;
    container.appendChild(label);

    if (hasBar) {
        const bar = document.createElement("div");
        bar.classList.add("difficulty-metadata-bar");
        container.appendChild(bar);

        const innerBar = document.createElement("div");
        innerBar.classList.add("difficulty-metadata-inner-bar");
        innerBar.style.width = `${attributes.percentage}%`;
        bar.appendChild(innerBar);
    }

    return container;
}

function createDifficultyContainer(beatmap: MappoolBeatmap): HTMLDivElement {
    const container = document.createElement("div");
    container.classList.add("column-container", "star-rating-container");

    const starRatingDiffContainer = document.createElement("div");
    starRatingDiffContainer.classList.add("star-rating-diff-container");
    container.appendChild(starRatingDiffContainer)

    const starRating = document.createElement("p");
    starRating.classList.add("star-rating");
    starRating.innerHTML = `${Math.round(beatmap.star_rating*100)/100}★`;
    starRatingDiffContainer.appendChild(starRating);

    const difficulty = document.createElement("p");
    difficulty.classList.add("difficulty");
    difficulty.innerHTML = escapeHtml(beatmap.beatmap_metadata.difficulty);
    starRatingDiffContainer.appendChild(difficulty);

    const attributesContainer = document.createElement("div");
    attributesContainer.classList.add("hide", "column-container", "difficulty-metadata-container");
    container.appendChild(attributesContainer);

    let difficultyAttributes = getRealAttributes(beatmap);
    difficultyAttributes.length.value = formatLength(difficultyAttributes.length.value);

    const length_bpm = createAttributeLabel("Length", difficultyAttributes.length, false);
    const bpm = createAttributeLabel("BPM", difficultyAttributes.bpm, false);
    length_bpm.appendChild(bpm.children[0]);
    attributesContainer.append(
        createAttributeLabel("CS", difficultyAttributes.cs),
        createAttributeLabel("HP", difficultyAttributes.hp),
        createAttributeLabel("OD", difficultyAttributes.od),
        createAttributeLabel("AR", difficultyAttributes.ar),
        length_bpm
    );

    return container;
}

function createMetadataContainer(metadata: BeatmapsetMetadata): HTMLDivElement {
    const container = document.createElement("div");
    container.classList.add("column-container", "metadata-container");
    
    const row1 = document.createElement("div");
    row1.classList.add("row-container");
    container.appendChild(row1);

    const row2 = document.createElement("div");
    row2.classList.add("row-container");
    container.appendChild(row2);

    const title = document.createElement("p");
    title.classList.add("title");
    title.innerHTML = escapeHtml(metadata.title);
    row1.appendChild(title);

    const artist = document.createElement("p")
    artist.classList.add("artist");
    artist.innerHTML = escapeHtml(metadata.artist);
    row2.appendChild(artist);

    const mapper = document.createElement("p");
    mapper.classList.add("mapper");
    mapper.innerHTML = escapeHtml(metadata.creator);
    row2.appendChild(mapper);

    return container;
}

function createBeatmapCover(bmSlot: string, beatmapsetId: number): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.classList.add("beatmap-cover-fade-wrapper");

    const banner = document.createElement("img");
    banner.classList.add("beatmap-cover");
    banner.src = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/cover.jpg`;
    banner.alt = "";
    // set to a singular pixel image
    banner.addEventListener("error", () => {banner.src = "data:image/jpg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wgARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAQ//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAn//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==";});
    wrapper.appendChild(banner);

    const fade = document.createElement("div");
    fade.classList.add("beatmap-cover-fade");
    wrapper.appendChild(fade);

    const slot = document.createElement("p");
    slot.classList.add("modification");
    slot.innerHTML = escapeHtml(bmSlot);
    fade.appendChild(slot);

    return wrapper;
}

export function mappoolSetup() {
    const favoriteBtn = getElementByIdOrThrow("favorite-btn");
    const favoriteSvg = favoriteBtn.children.item(0) as SVGElement;
    const editBtn = getElementByIdOrThrow("edit-btn");
    const deleteBtn = getElementByIdOrThrow("delete-btn");
    const mappoolContainer = getElementByIdOrThrow("mappool-container");
    const mappoolName = getElementByIdOrThrow("mappool-name");
    const mappoolDescription = getElementByIdOrThrow("mappool-description");

    if (favoriteSvg === null) {
        throw new Error("why is the star svg gone ????");
    }

    const mappoolId = parseInt(window.location.toString().split("/")[5]);

    const SLOT_ORDER = ["NM", "HD", "HR", "DT", "FM", "EZ", "HT", "*", "TB"];

    let favoriteDebounce = false;
    let deleteDebounce = false;

    function favoriteMappool() {
        if (favoriteDebounce) return;
        favoriteDebounce = true;
        
        const favorite = favoriteSvg.getAttribute("fill") === "none";
        manager.api.favoriteMappool(
            mappoolId,
            favorite,
        ).then((resp) => {
            favoriteDebounce = false;
            if (resp === null) {
                favoriteSvg.setAttribute("fill", favorite ? "white":"none");
            }
        });
    }
    
    function deleteMappool() {
        deleteDebounce = true;
    
        manager.api.deleteMappool(mappoolId).then((resp) => {
            if (resp === null) {
                window.location.replace(`/db/mappools/`);
                return;
            }
            deleteDebounce = false;
        });
    }

    function createBeatmap(connection: MappoolBeatmapConnection): HTMLAnchorElement {
        const beatmap = connection.beatmap;

        const slotColor = getSlotColor(connection.slot);
        const ratingColor = getStarRatingColor(beatmap.star_rating);
    
        const wrapping = document.createElement("a");
        wrapping.href = `https://osu.ppy.sh/b/${beatmap.beatmap_metadata.id}`;
        wrapping.target = "_blank";
        wrapping.classList.add("beatmap-link-wrapping");
    
        const topBar = document.createElement("div");
        topBar.classList.add("top-bar");
        topBar.style.backgroundImage = `linear-gradient(to left, ${ratingColor} 150px, ${slotColor} 150px, ${slotColor})`;
        wrapping.appendChild(topBar);
    
        const topBarSmall = document.createElement("div");
        topBarSmall.classList.add("top-bar", "small");
        topBarSmall.style.background = slotColor;
        wrapping.appendChild(topBarSmall);
    
        const container = document.createElement("div");
        container.classList.add("beatmap");
        container.style.backgroundImage = `linear-gradient(to left, ${ratingColor} 150px, rgba(0, 0, 0, 0.3) 150px, rgba(0, 0, 0, 0.3))`;
        wrapping.appendChild(container);

        container.appendChild(createBeatmapCover(connection.slot, beatmap.beatmapset_metadata.id));
        container.appendChild(createMetadataContainer(beatmap.beatmapset_metadata));
        const diffContainer = createDifficultyContainer(beatmap);
        container.appendChild(diffContainer);
    
        function onHover() {
            for (const child of diffContainer.children) {
                if (child.classList.contains("hide")) {
                    child.classList.remove("hide");
                } else {
                    child.classList.add("hide");
                }
            }
        }
    
        container.addEventListener("mouseenter", onHover);
        container.addEventListener("mouseleave", onHover);
    
        return wrapping;
    }

    function createMappool(data: MappoolExtended | undefined) {
        if (data === undefined) {
            return;
        }

        document.title += `: ${data.name}`;

        if (manager.api.session.user !== null) {
            favoriteBtn.classList.remove("hidden");
            favoriteSvg.setAttribute("fill", data.is_favorited ? "white":"none");
    
            if (data.submitted_by_id === manager.api.session.user.id || manager.api.session.user.is_admin) {
                editBtn.classList.remove("hidden");
                deleteBtn.classList.remove("hidden");
            }
        }
    
        mappoolName.innerHTML = escapeHtml(data.name);
        mappoolDescription.innerHTML = "<span class='description'>Description: </span>"+escapeHtml(data.description);
    
        const abcSortedBeatmaps = data.beatmap_connections.sort((a, b) => a.slot.charCodeAt(0) - b.slot.charCodeAt(0));
        const getSlotOrderIndex = (a) => {
            const mod = a.slot.substring(0, 2).toUpperCase();
            const order = SLOT_ORDER.indexOf(mod);
            return order === -1 ? SLOT_ORDER.indexOf("*") : order;
        };
        for (const connection of abcSortedBeatmaps.sort((a, b) => getSlotOrderIndex(a) - getSlotOrderIndex(b))) {
            mappoolContainer.appendChild(createBeatmap(connection));
        }
    }

    favoriteBtn.addEventListener("click", favoriteMappool);
    editBtn.addEventListener("click", () => {
        window.location.href = window.location.href+"edit";
    });
    setHoldClick(deleteBtn, deleteMappool);
    manager.api.getMappool(mappoolId).then(createMappool);
}
