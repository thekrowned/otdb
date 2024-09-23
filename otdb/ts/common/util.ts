import {VALID_ROLES} from "./constants";

export function getElementByIdOrThrow<T extends HTMLElement>(id: string): T {
    const elm = document.getElementById(id);
    if (elm == null) {
        throw new Error(`Could not find element with id ${id}`);
    }
    return elm as T;
}

export function querySelectorOrThrow(base: Document | Element, pattern: string): Element {
    const elm = base.querySelector(pattern);
    if (elm == null) {
        throw new Error(`Could not find element from pattern ${pattern}`);
    }
    return elm;
}

export function removeChildren(elm: Element) {
    while (elm.children.length > 0) {
        elm.children.item(0)?.remove();
    }
}

export function createXSVG(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 1 1");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M0 0 L1 1 M1 0 L0 1");
    path.setAttribute("stroke", "black");
    path.setAttribute("stroke-width", "0.1");

    svg.append(path);

    return svg;
}

export function formatLength(length): string {
    const minutes = Math.floor(length / 60);
    const seconds = length % 60;
    return `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
}

export function getCookies(): { [key: string]: string } {
    return Object.fromEntries(document.cookie.split(";").map((a) => a.split("=", 2)));
}

export function getStarRatingColor(rating: number): string {
    const ratingRange = [0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9];
    const colorRange = [[66, 144, 251], [79, 192, 255], [79, 255, 213], [124, 255, 79], [246, 240, 92], [255, 128, 104], [255, 78, 111], [198, 69, 184], [101, 99, 222], [24, 21, 142], [0, 0, 0]];
    const gamma = 2.2;

    function hex(n: number): string {
        return (n < 16 ? "0" : "") + n.toString(16);
    }

    function exponential(a: number, b: number, y: number): (t: number) => number {
        return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
            return Math.pow(a + t * b, y);
        }
    }

    function interpolate(start: number[], end: number[]): (t: number) => string {
        const r = exponential(start[0], end[0], gamma);
        const g = exponential(start[1], end[1], gamma);
        const b = exponential(start[2], end[2], gamma);
        return (t) => "#" + hex(Math.round(r(t))) + hex(Math.round(g(t))) + hex(Math.round(b(t)));
    }

    if (rating < 0.1) return "#AAAAAA";
    if (rating >= 9) return "#000000";

    for (let i=0; i<ratingRange.length; i++) {
        if (rating < ratingRange[i]) {
            return interpolate(colorRange[i-1], colorRange[i])((rating - ratingRange[i-1]) / (ratingRange[i] - ratingRange[i-1]));
        }
    }
}

export function * parseRolesFlag(flag: number): Generator<string> {
    for (let i=0; i<VALID_ROLES.length; i++) {
        if (flag & (1 << i))
            yield VALID_ROLES[i];
    }
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function askBeforeLeaving(check: () => boolean) {
    window.addEventListener("beforeunload", (evt) => {
        if (check()) {
            evt.preventDefault();
            return "";
        }
    });
}

export function escapeHtml(unsafe: string) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }