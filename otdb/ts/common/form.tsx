import jsx from "../jsxFactory";

import {clamp, createXSVG} from "./util";

// types

type ValidationType = "any" | "int" | "uint" | "mod" | null;
type ValidationFn = (text: string) => boolean;

export type InputType = "text" | "button" | "text-dropdown" | "text-search";

interface InputAttributes {
    type: InputType;
    label: string;
    validation?: ValidationType;
    innerStyle?: string;
}

interface BaseTextInputAttributes extends InputAttributes {
    required?: boolean;
    "max-length"?: number;
}

interface TextInputAttributes extends BaseTextInputAttributes {
    type: "text";
    textarea?: boolean;
}

interface TextButtonAttributes extends InputAttributes {
    type: "button";
    danger?: boolean;
    square?: boolean;
}

interface BaseTextDropdownAttributes extends BaseTextInputAttributes {
    options: string[];
    multi?: boolean;
}

interface TextDropdownAttributes extends BaseTextDropdownAttributes {
    type: "text-dropdown";
}

interface TextSearchAttributes extends BaseTextDropdownAttributes {
    type: "text-search";
}

export type GetInputAttributes<T> =
    T extends TextSearch<any> ? TextSearchAttributes :
    T extends TextDropdown ? TextDropdownAttributes :
    T extends TextInput ? TextInputAttributes :
    T extends TextButton ? TextButtonAttributes :
    InputAttributes;

// input manager

function inputFromType<T extends Input>(type: InputType, elm: HTMLElement): T {
    const input = {
        "text": TextInput,
        "text-dropdown": TextDropdown,
        "button": TextButton,
        "text-search": TextSearch
    }[type];

    if (input === undefined)
        throw new Error(`Invalid input type '${type}'`);

    return new input(elm) as unknown as T;
}

export class InputManager {
    protected inputs: Array<Input>;

    public submit: TextButton;

    public constructor() {
        this.inputs = [];

        for (const input of Array.from(document.querySelectorAll("form-input"))) {
            const initializedInput = inputFromType(
                input.getAttribute("type") as InputType,
                input as HTMLElement
            );
            this.add(initializedInput, false);

            if (initializedInput.id === "submit") {
                this.submit = initializedInput as TextButton;
                this.submit.disable();
            }
        }

        if (this.submit === null && this.inputs.length > 0) {
            throw new Error("Could not find a submit form button");
        }
    }

    /**
     * Add an input object to the manager
     * 
     * @param input
     * @param checkValidity - whether to make a check for form submission validity
     */
    public add(input: Input, checkValidity: boolean = true) {
        input.manager = this;
        this.inputs.push(input);
        if (checkValidity) {
            this.onInputChange(input);
        }
    }

    /**
     * Remove input by id
     * 
     * @param id - id of input
     * @returns input object if found, otherwise null
     */
    public remove<T extends Input>(id: string): T | null {
        for (var i = 0; i < this.inputs.length; i++) {
            if (this.inputs[i].id === id) {
                const [input] = this.inputs.splice(i, 1);
                this.onInputChange();
                return input as T;
            }
        }
    }

    /**
     * Create a new input object
     * 
     * @param id 
     * @param attributes 
     * @param parent 
     * @returns 
     */
    public create<T extends Input>(id: string, attributes: GetInputAttributes<T>, parent: Node | null): T {
        const formInput = <form-input id={id}></form-input> as HTMLElement;
        if (parent !== null)
            parent.appendChild(formInput);

        for (const key of Object.keys(attributes)) {
            let value = attributes[key];
            if (typeof value === "object") {
                value = value.join(",");
            } else if (typeof value === "boolean") {
                if (value) {
                    value = "";
                } else {
                    continue;
                }
            }

            formInput.setAttribute(key, attributes[key]);
        }

        const input = inputFromType<T>(attributes.type, formInput);
        this.add(input);

        return input as T;
    }

    /**
     * Get an input by id
     * 
     * @param id - id of input
     * @returns input object if found, otherwise null
     */
    public get<T extends Input>(id: string): T | null {
        for (const input of this.inputs) {
            if (input.id == id) {
                return input as T;
            }
        }

        return null;
    }

    /**
     * Get an input by id or throw an error
     * 
     * @param id - id of input
     * @returns input object
     */
    public getRequired<T extends Input>(id: string): T {
        const input = this.get(id);
        if (input !== null) {
            return input as T;
        }

        throw new Error(`Could not find required input by id '${id}'`);
    }

    /**
     * Query for an input by id
     * 
     * @param match - check if id includes this string
     * @returns list of matching inputs
     */
    public query<T extends Input>(match: string): T[] {
        let results: T[] = [];
        for (const input of this.inputs) {
            if (input.id.includes(match)) {
                results.push(input as T);
            }
        }

        return results;
    }

    public onInputChange(input: Input | null = null) {
        if (input !== null && !input.checkValueValidity()) {
            this.submit.disable()
            return;
        }

        for (const otherInput of this.inputs) {
            if (otherInput === input) continue;
            if (!otherInput.checkValueValidity()) return;
        }

        this.submit.enable()
    }
}

// input classes

abstract class Input {
    static type: string;

    public id: string;
    public type: InputType;
    public manager: InputManager | null;
    public elm: HTMLElement;
    public innerElm: HTMLElement;

    public constructor(elm: HTMLElement) {
        const id = elm.getAttribute("id");
        if (id === null) {
            throw new Error("Input must have an id");
        }

        const innerElm = document.createElement("inner-form-input");
        elm.append(innerElm);

        if (elm.hasAttribute("innerStyle")) {
            innerElm.style.cssText = elm.getAttribute("innerStyle") as string;
        }

        this.elm = elm;
        this.innerElm = innerElm;
        this.id = id;
    }

    public abstract checkValueValidity(): boolean;

    protected onInputChange(evt: Event | null) {
        this.manager.onInputChange(this);
    }

    public getParentContainer(): ParentNode {
        return (this.innerElm.parentNode as ParentNode).parentNode as ParentNode;
    }
}

export class TextInput extends Input {
    static type: InputType = "text";

    protected label: HTMLParagraphElement;
    protected input: HTMLInputElement | HTMLTextAreaElement;
    protected validation: ValidationFn | null;
    protected lastIsValid: boolean = true;
    protected isRequired: boolean;
    protected maxLength: number | null;

    public constructor(elm: HTMLElement) {
        super(elm);

        this.innerElm.classList.add("text-input-container");

        const label = (
            <p class="text-input-label">{ elm.getAttribute("label") ?? "" }</p>
        )as HTMLParagraphElement;
        this.innerElm.appendChild(label);

        if (elm.hasAttribute("required")) {
            this.innerElm.appendChild(
                <p class="text-input-required">*</p>
            );
        }

        var input: HTMLInputElement | HTMLTextAreaElement;
        if (!elm.hasAttribute("textarea")) {
            input = <input type="text"></input> as HTMLInputElement;
        } else {
            input = (
                <textarea class="textarea" rows={ elm.getAttribute("rows") ?? "4" }></textarea>
            ) as HTMLTextAreaElement;
            label.classList.add("textarea");
        }
        input.classList.add("text-input");
        this.innerElm.appendChild(input);

        // if (textType == "text-dropdown") {
        //     inputContainer = <div className="dropdown-input-container">{input}</div> as HTMLDivElement;
        //     this.innerElm.appendChild(inputContainer);

        const maxLengthStr = elm.getAttribute("max-length");
        const maxLength = maxLengthStr === null ? null : parseInt(maxLengthStr);

        this.label = label;
        this.input = input;
        this.validation = getCheckFn(elm.getAttribute("validation") as ValidationType);
        this.isRequired = elm.hasAttribute("required");
        this.maxLength = maxLength;

        this.input.addEventListener("input", (evt: InputEvent) => this.onInputChange(evt));
        this.input.addEventListener("focus", () => {
            this.label.classList.add("active");
            this.input.focus();
        });
        this.input.addEventListener("blur", () => {
            if (this.isEmpty()) {
                this.label.classList.remove("active");
            }
        });
    }

    protected override onInputChange(evt: InputEvent | null) {
        const isValid = this.input.value === "" ? true : (
            (this.maxLength === null || this.input.value.length <= this.maxLength) &&
            (this.validation === null || this.validation(this.input.value))
        );

        if (this.lastIsValid && !isValid) {
            this.innerElm.classList.add("invalid");
        } else if (!this.lastIsValid && isValid) {
            this.innerElm.classList.remove("invalid");
        }

        this.lastIsValid = isValid;

        super.onInputChange(evt);
    }

    protected isEmpty(): boolean {
        return this.input.value === "";
    }

    /**
     * Set the text of this input
     * 
     * @param value - text
     */
    public setValue(value: string) {
        this.input.value = value;
        if (!this.isEmpty()) {
            this.label.classList.add("active");
        }
        this.onInputChange(null);
    }

    /**
     * Get the current text of this input
     * 
     * @returns input text
     */
    public getValue(): string {
        return this.input.value;
    }

    /**
     * Change the width of this input
     * 
     * @param width
     */
    public resize(width: number) {
        this.innerElm.style.width = `${width}px`;
    }

    public checkValueValidity() {
        return this.lastIsValid && (!this.isRequired || this.input.value.trim() !== "");
    }

    /**
     * Remove focus from this input
     */
    public blur() {
        this.input.blur();
    }

    /**
     * Put focus on this input
     */
    public focus() {
        this.input.focus();
    }
}

export class TextDropdown<T = null> extends TextInput {
    static type: InputType = "text-dropdown";

    protected dropdown: HTMLDivElement;
    protected inputContainer: HTMLDivElement;
    protected multiAnswer: boolean;
    protected activeItem: number | null = null;
    protected _items: TextDropdownItem<T>[];

    public get items(): TextDropdownItem<T>[] {
        return this._items;
    }

    protected set items(value: TextDropdownItem<T>[]) {
        this._items = value;
    }

    public constructor(elm: HTMLElement) {
        super(elm);

        const inputContainer = <div class="dropdown-input-container"></div> as HTMLDivElement;
        inputContainer.append(this.input);
        this.innerElm.append(inputContainer);

        const dropdown = <div class="dropdown hidden"></div> as HTMLDivElement;
        this.innerElm.appendChild(dropdown);

        this.dropdown = dropdown;
        this.inputContainer = inputContainer;
        this.multiAnswer = elm.hasAttribute("multi");
        this.items = [];

        this.validation = () => {
            for (const item of this.items) {
                if (item.valid)
                    return true;
            }

            return false;
        }

        const options = elm.getAttribute("options")?.split(",");
        if (options !== undefined) {
            for (const option of options) {
                this.createItem(option);
            }
        }

        this.input.addEventListener("focus", () => this.dropdown.classList.remove("hidden"));
        this.input.addEventListener("blur", () => this.dropdown.classList.add("hidden"));
        this.input.addEventListener("keydown", (evt: KeyboardEvent) => this.handleKeydown(evt));
    }

    protected override onInputChange(evt: InputEvent | null) {
        for (const item of this.items)
            item.onInputChange(this.input.value);

        super.onInputChange(evt);
    }

    private getPickableItems(): TextDropdownItem<T>[] {
        return this.items.filter((item) => !item.picked);
    }

    private handleKeydown(evt: KeyboardEvent) {
        if (evt.code === "ArrowDown") {
            this.setActiveItem((this.activeItem ?? -1) + 1);
        } else if (evt.code === "ArrowUp") {
            this.setActiveItem((this.activeItem ?? 1) - 1);
        } else if (evt.code === "Enter") {
            if (this.activeItem !== null)
                this.getPickableItems()[this.activeItem].pick();
        } else {
            return;
        }

        evt.preventDefault();
    }

    private setActiveItem(i: number) {
        const items = this.getPickableItems();

        if (items.length === 0) {
            this.activeItem = null;
            return;
        }

        if (this.activeItem !== null)
            items[this.activeItem].removeActive();

        this.activeItem = clamp(i, 0, items.length-1);
        items[this.activeItem].setActive();
        this.dropdown.scroll({
            top: items[this.activeItem].getYScrollTo(this.dropdown)
        });
    }

    protected isEmpty(): boolean {
        if (!super.isEmpty()) {
            return false;
        }

        for (const item of this.items) {
            if (item.picked) {
                return false;
            }
        }

        return true;
    }

    private onItemPicked(item: TextDropdownItem<T>) {
        if (this.multiAnswer) {
            this.inputContainer.insertBefore(item.pickedElm, this.input);

            this.setValue("");
        } else {
            this.setValue(item.label);
            this.blur();
        }
    }

    /**
     * Create an item on the dropdown from a label
     * 
     * @param label - label of new item
     * @param value - inner value of the item
     * @returns the new item object
     */
    public createItem(label: string, value: T = null): TextDropdownItem<T> {
        const item = new TextDropdownItem<T>(
            label,
            this.multiAnswer,
            (item) => this.onItemPicked(item),
            value
        );

        this.dropdown.append(item.elm);
        this.items.push(item);

        item.elm.addEventListener("mouseover", () => {
            item.setActive();
            this.activeItem = this.items.indexOf(item);
        });
        item.elm.addEventListener("mouseleave", () => item.removeActive());

        return item;
    }

    /**
     * Get an item by its label
     * 
     * @param label - label of item
     * @returns item object or null if it's not found
     */
    public getItem(label: string): TextDropdownItem<T> | null {
        for (const item of this.items) {
            if (item.label === label) {
                return item;
            }
        }

        return null;
    }

    /**
     * Clear all items in the dropdown
     */
    public clearItems() {
        for (const item of this.items)
            item.onRemoved();

        this.items = [];
        this.activeItem = null;
    }

    /**
     * Get list of labels for currently picked items
     * 
     * @returns list of labels
     */
    public getValues(): string[] {
        return this.items.filter((item) => item.picked).map((item) => item.label);
    }

    /**
     * Get list of values for currently picked items
     *
     * @returns list of values T
     */
    public getInnerValues(): T[] {
        return this.items.filter((item) => item.picked).map((item) => item.value);
    }
}

export class TextDropdownItem<T = null> {
    private _elm: HTMLDivElement;
    private multi: boolean;
    private _picked: boolean = false;
    private _value: T | null = null;
    private _valid: boolean = false;
    private _pickedElm: HTMLElement;

    public get elm(): HTMLDivElement {
        return this._elm;
    }

    public get picked(): boolean {
        return this._picked;
    }

    protected set picked(value: boolean) {
        if (this.multi) {
            if (value) {
                this.elm.classList.add("hidden");
                this.pickedElm = this.createPickedElm();
            } else
                this.elm.classList.remove("hidden");
        }

        this._picked = value;
    }

    public get value(): T | null {
        return this._value;
    }

    protected set value(value: T | null) {
        this._value = value;
    }

    public get valid(): boolean {
        return this._valid;
    }

    protected set valid(value: boolean) {
        this._valid = value;
    }

    public get label(): string {
        return this.elm.innerHTML;
    }

    public get pickedElm(): HTMLElement {
        return this._pickedElm;
    }

    protected set pickedElm(value: HTMLDivElement) {
        this._pickedElm = value;
    }

    public constructor(
        label: string,
        multi: boolean,
        onItemPicked: (item: TextDropdownItem<T>) => void,
        innerValue: T | null = null
    ) {
        this._elm = <div class="dropdown-item">{label}</div> as HTMLDivElement;
        this.multi = multi;
        this.value = innerValue;

        // prevents dropdown from closing before click goes through
        this.elm.addEventListener("mousedown", (evt) => evt.preventDefault());
        this.elm.addEventListener("click", () => {
            this.onPicked();
            onItemPicked(this);
        });
    }

    public onInputChange(text: string) {
        if (!this.multi && this.picked && text !== this.label)
            this.unpick();

        this.valid = text === "" ? true : this.label.toLowerCase().includes(text.toLowerCase());
        if (this.valid && !this.picked) {
            this.elm.classList.remove("hidden");
        } else {
            this.elm.classList.add("hidden");
        }
    }

    private createPickedElm(): HTMLDivElement {
        const container = (
            <div class="dropdown-multi-answer-container">
                <p class="dropdown-multi-answer">{this.label}</p>
            </div>
        ) as HTMLDivElement;

        const removeAnswer = <div class="dropdown-multi-answer-remove"></div>;

        const x = createXSVG();
        x.setAttribute("width", "10px");
        x.setAttribute("height", "10px");
        x.classList.add("dropdown-multi-answer-svg");

        removeAnswer.append(x);
        container.append(removeAnswer);

        removeAnswer.addEventListener("click", () => this.unpick());

        return container;
    }

    private onPicked() {
        this.picked = true;
    }

    public pick() {
        this.elm.click();
    }

    public unpick() {
        this.picked = false;
    }

    public onRemoved() {
        this.elm.remove();
    }

    public setActive() {
        this.elm.classList.add("active");
    }

    public removeActive() {
        this.elm.classList.remove("active");
    }

    public getYScrollTo(dropdown: HTMLElement): number {
        return this.elm.getBoundingClientRect().y - dropdown.getBoundingClientRect().y;
    }
}

type TextSearchFunc<T> = (query: string) => Promise<{label: string, value: T}[]>;

export class TextSearch<T> extends TextDropdown<T> {
    static type: InputType = "text-search";

    private search: TextSearchFunc<T>;
    private currentSearch: number | null = null;

    public constructor(elm: HTMLElement) {
        super(elm);

        this.validation = () => true;
    }

    public bindSearch(func: TextSearchFunc<T>) {
        this.search = func;
    }

    protected override onInputChange(evt: InputEvent | null) {
        super.onInputChange(evt);

        if (this.currentSearch)
            clearTimeout(this.currentSearch)

        for (const item of this.items) {
            if (item.picked) {
                return;
            }
        }

        this.clearItems();

        if (this.input.value.trim().length > 0)
            this.currentSearch = setTimeout(() => {
                this.search(this.input.value).then((result) => this.handleSearchResult(result));
                this.currentSearch = null;
            }, 500);
    }

    private handleSearchResult(result: {label: string, value: T}[]) {
        this.clearItems();

        for (const item of result) {
            this.createItem(item.label, item.value);
        }
    }
}

export class TextButton extends Input {
    static type: InputType = "button";

    public isEnabled = true;

    public constructor(elm: HTMLElement) {
        super(elm);

        this.innerElm.classList.add("button");
        this.innerElm.innerHTML = elm.getAttribute("label") ?? "";

        if (elm.hasAttribute("danger"))
            this.innerElm.classList.add("danger");

        if (elm.hasAttribute("square"))
            this.innerElm.classList.add("square");
    }

    /**
     * Add a callback to be performed if the button is clicked while enabled
     * 
     * @param callback
     */
    public addCallback(callback: (MouseEvent) => any) {
        this.innerElm.addEventListener("click", (evt) => {
            if (this.isEnabled) {
                callback(evt);
            }
        });
    }

    /**
     * Enable the button for clicking
     */
    public enable() {
        this.innerElm.classList.remove("disabled");
        this.isEnabled = true;
    }

    /**
     * Disable the button from clicking
     */
    public disable() {
        this.innerElm.classList.add("disabled");
        this.isEnabled = false;
    }

    /**
     * Simulate a click on the button
     */
    public click() {
        this.innerElm.click();
    }

    public checkValueValidity(): boolean {
        return true;
    }
}

// validation

function isInt(text: string): boolean {
    return /^-?\d+$/.test(text);
}

function isUInt(text: string): boolean {
    return /^\d+$/.test(text);
}

function isMod(text: string): boolean {
    return /^((NM)|(HD)|(HR)|(DT)|(FM)|(EZ)|(HT)|(FL)|(TB)|(OTH)|(RX)|(AP))\d+$/i.test(text);
}

function getCheckFn(valid: ValidationType): ValidationFn | null {
    switch (valid) {
        case "any":
            return null;
        case "int":
            return isInt;
        case "uint":
            return isUInt;
        case "mod":
            return isMod;
        case null:
            return null;
        default:
            throw new Error(`${valid} is not a valid input validation`);
    }
}