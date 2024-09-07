import jsx from "../jsxFactory";

import { createXSVG } from "./util";

// types

type ValidationType = "any" | "int" | "uint" | "mod" | null;
type ValidationFn = (text: string) => boolean;

export type InputType = "text" | "button" | "text-dropdown";

interface InputAttributes {
    type: InputType;
    label: string;
    validation?: ValidationType;
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

interface TextDropdownAttributes extends BaseTextInputAttributes {
    type: "text-dropdown";
    options: string[];
    multi?: boolean;
}

export type GetInputAttributes<T> = 
    T extends TextDropdown ? TextDropdownAttributes :
    T extends TextInput ? TextInputAttributes :
    T extends TextButton ? TextButtonAttributes :
    InputAttributes;

// input manager

export class InputManager {
    protected inputs: Array<Input>;

    public submit: TextButton;

    public constructor() {
        this.inputs = [];

        for (const input of Array.from(document.querySelectorAll("form-input"))) {
            const initializedInput = initInput(input as HTMLElement)
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
    public create<T extends Input>(id: string, attributes: GetInputAttributes<T>, parent: Node): T {
        const formInput = <form-input id={id}></form-input> as HTMLElement;
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

        const input = initInput(formInput);
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

    public constructor(id: string, elm: HTMLElement) {
        this.id = id;
        this.elm = elm;
    }

    public abstract checkValueValidity(): boolean;

    protected onInputChange(evt: Event | null) {
        this.manager.onInputChange(this);
    }

    public getParentContainer(): ParentNode {
        return (this.elm.parentNode as ParentNode).parentNode as ParentNode;
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

    public constructor(id: string, elm: HTMLElement, label: HTMLParagraphElement, input: HTMLInputElement | HTMLTextAreaElement, validation: ValidationFn | null, required: boolean = false, maxLength: number | null = null) {
        super(id, elm);

        this.label = label;
        this.input = input;
        this.validation = validation;
        this.isRequired = required;
        this.maxLength = maxLength;

        this.input.addEventListener("input", (evt) => this.onInputChange(evt));
        this.input.addEventListener("focus", (evt) => {
            this.label.classList.add("active");
            this.input.focus();
        });
        this.input.addEventListener("blur", (evt) => {
            if (this.isEmpty()) {
                this.label.classList.remove("active");
            }
        });
    }

    protected override onInputChange(evt: Event | null) {
        const isValid = this.input.value === "" ? true : (
            (this.maxLength === null || this.input.value.length <= this.maxLength) &&
            (this.validation === null || this.validation(this.input.value))
        );

        if (this.lastIsValid && !isValid) {
            this.elm.classList.add("invalid");
        } else if (!this.lastIsValid && isValid) {
            this.elm.classList.remove("invalid");
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
        this.elm.style.width = `${width}px`;
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

export class TextDropdown extends TextInput {
    static type: InputType = "text-dropdown"

    protected dropdown: HTMLDivElement;
    protected inputContainer: HTMLDivElement;
    protected multiAnswer: boolean;
    
    public items: TextDropdownItem[];

    public constructor(
        id: string,
        elm: HTMLElement,
        label: HTMLParagraphElement,
        input: HTMLInputElement | HTMLTextAreaElement,
        required: boolean,
        maxLength: number | null,
        dropdown: HTMLDivElement,
        inputContainer: HTMLDivElement,
        multiAnswer: boolean
    ) {
        super(id, elm, label, input, null, required, maxLength);

        this.dropdown = dropdown;
        this.inputContainer = inputContainer;
        this.multiAnswer = multiAnswer;
        this.items = [];

        this.validation = (text) => {
            let isValid = false;
            for (const item of this.items) {
                // no break to make sure all items are called
                if (item.isValid(text)) {
                    isValid = true;
                }
            }

            return isValid;
        }

        input.addEventListener("focus", (evt) => {
            this.dropdown.classList.remove("hidden");
        });
        input.addEventListener("blur", (evt) => {
            this.dropdown.classList.add("hidden");
        });
    }

    protected override onInputChange(evt: Event | null) {
        super.onInputChange(evt);

        if (this.getValue() === "") {
            (this.validation as ValidationFn)("") // unhide dropdown container
        }
    }

    protected isEmpty(): boolean {
        if (!super.isEmpty()) {
            return false;
        }

        for (const item of this.items) {
            if (item.isPicked()) {
                return false;
            }
        }

        return true;
    }

    public onItemPicked(item: TextDropdownItem) {
        if (this.multiAnswer) {
            const container = document.createElement("div");
            container.classList.add("dropdown-multi-answer-container");

            const answer = document.createElement("p");
            answer.innerHTML = item.getLabel();
            answer.classList.add("dropdown-multi-answer");

            const removeAnswer = document.createElement("div");
            removeAnswer.classList.add("dropdown-multi-answer-remove");

            const x = createXSVG();
            x.setAttribute("width", "10px");
            x.setAttribute("height", "10px");
            x.classList.add("dropdown-multi-answer-svg");
            removeAnswer.append(x);

            container.append(answer, removeAnswer);

            removeAnswer.addEventListener("click", (evt) => {
                this.onItemRemoved(item, container);
            });

            this.inputContainer.insertBefore(container, this.input);

            this.setValue("");
        } else {
            this.setValue(item.getLabel());
            this.blur();
        }

        item.isValid(this.getValue()); // hide option
    }

    public onItemRemoved(item: TextDropdownItem, container: HTMLDivElement) {
        container.remove();
        item.onRemoved();
        item.isValid(this.getValue()); // unhide if valid
        if (this.isEmpty()) {
            // unactivate label
            this.label.classList.remove("active");
        }
    }

    /**
     * Add an item from an object
     * 
     * @param item - item object
     */
    public addItem(item: TextDropdownItem) {
        this.items.push(item);
    }

    /**
     * Create an item on the dropdown from a label
     * 
     * @param label - label of new item
     * @returns the new item object
     */
    public createItem(label: string): TextDropdownItem {
        const item = <div class="dropdown-item">{label}</div> as HTMLDivElement;

        this.dropdown.appendChild(item);

        const itemObj = new TextDropdownItem(this, item);
        this.addItem(itemObj);

        return itemObj;
    }

    /**
     * Get an item by its label
     * 
     * @param label - label of item
     * @returns item object or null if it's not found
     */
    public getItem(label: string): TextDropdownItem | null {
        for (const item of this.items) {
            if (item.getLabel() === label) {
                return item;
            }
        }

        return null;
    }

    /**
     * Get list of labels for currently picked items
     * 
     * @returns list of labels
     */
    public getValues(): string[] {
        return this.items.filter((item) => item.isPicked()).map((item) => item.getLabel());
    }
}

export class TextDropdownItem {
    protected parent: TextDropdown;
    protected elm: HTMLDivElement;
    protected picked: boolean = false;

    public constructor(parent: TextDropdown, elm: HTMLDivElement) {
        this.parent = parent;
        this.elm = elm;

        this.elm.onmousedown = (evt) => {
            evt.preventDefault();
        }

        this.elm.onclick = (evt) => {
            this.picked = true;
            this.parent.onItemPicked(this);
        }
    }

    /**
     * Get the label of this item
     * 
     * @returns label
     */
    public getLabel(): string {
        return this.elm.innerHTML;
    }

    /**
     * Check if this item is picked
     * 
     * @returns true if item is picked
     */
    public isPicked(): boolean {
        return this.picked;
    }

    public isValid(text: string) {
        const isValid = text === "" ? true : this.getLabel().toLowerCase().includes(text.toLowerCase());
        if (isValid && !this.picked) {
            this.elm.classList.remove("hidden");
        } else {
            this.elm.classList.add("hidden");
        }

        return isValid;
    }

    public onRemoved() {
        this.picked = false;
    }

    public pick() {
        this.elm.click();
    }
}

export class TextButton extends Input {
    static type: InputType = "button";

    public isEnabled = true;

    /**
     * Add a callback to be performed if the button is clicked while enabled
     * 
     * @param callback
     */
    public addCallback(callback: (MouseEvent) => any) {
        this.elm.addEventListener("click", (evt) => {
            if (this.isEnabled) {
                callback(evt);
            }
        });
    }

    /**
     * Enable the button for clicking
     */
    public enable() {
        this.elm.classList.remove("disabled");
        this.isEnabled = true;
    }

    /**
     * Disable the button from clicking
     */
    public disable() {
        this.elm.classList.add("disabled");
        this.isEnabled = false;
    }

    /**
     * Simulate a click on the button
     */
    public click() {
        this.elm.click();
    }

    public checkValueValidity(): boolean {
        return true;
    }
}

// input initialization

function initInput(elm: HTMLElement): Input {
    const id = elm.getAttribute("id");
    if (id === null) {
        throw new Error("Input must have an id");
    }

    const inner = document.createElement("inner-form-input");
    elm.append(inner);

    if (elm.hasAttribute("innerStyle")) {
        inner.style.cssText = elm.getAttribute("innerStyle") as string;
    }

    const inputType: InputType | "" = elm.getAttribute("type") as InputType ?? "";
    switch (inputType) {
        case "text":
            return initTextInput(id, elm, inner, inputType);
        case "text-dropdown":
            return initTextInput(id, elm, inner, inputType);
        case "button":
            return initTextButton(id, elm, inner);
        default:
            throw new Error(inputType === "" ? "Attempted to initialize input without a type" : `Attempted to initialize input of invalid type '${inputType}'`);
    }
}

function initTextInput(id: string, elm: HTMLElement, innerElm: HTMLElement, textType: InputType): TextInput | TextDropdown {
    innerElm.classList.add("text-input-container");

    const label = <p className="text-input-label">{ elm.getAttribute("label") ?? "" }</p> as HTMLParagraphElement;
    innerElm.appendChild(label);

    if (elm.hasAttribute("required")) {
        innerElm.appendChild(
            <p className="text-input-required">*</p>
        );
    }

    var input: HTMLInputElement | HTMLTextAreaElement;
    if (!elm.hasAttribute("textarea")) {
        input = <input type="text"></input> as HTMLInputElement;
    } else {
        input = <textarea className="textarea" rows={ elm.getAttribute("rows") ?? "4" }></textarea> as HTMLTextAreaElement;
        label.classList.add("textarea");
    }
    input.classList.add("text-input");

    let inputContainer: HTMLDivElement | null = null;
    if (textType == "text-dropdown") {
        inputContainer = <div className="dropdown-input-container">{input}</div> as HTMLDivElement;
        innerElm.appendChild(inputContainer);
    } else {
        innerElm.appendChild(input);
    }

    const maxLengthStr = elm.getAttribute("max-length");
    const maxLength = maxLengthStr === null ? null : parseInt(maxLengthStr);

    switch(textType) {
        case "text":
            return new TextInput(
                id,
                innerElm,
                label,
                input,
                getCheckFn(elm.getAttribute("validation") as ValidationType),
                elm.hasAttribute("required"),
                maxLength
            );
        case "text-dropdown":
            return initDropdown(
                id,
                elm,
                innerElm,
                label,
                input as HTMLInputElement,
                elm.hasAttribute("required"),
                inputContainer as HTMLDivElement,
                maxLength
            );
    }

    throw new Error("Invalid text input type");
}

function initDropdown(
    id: string,
    elm: HTMLElement,
    innerElm: HTMLElement,
    label: HTMLParagraphElement,
    input: HTMLInputElement,
    required: boolean,
    inputContainer: HTMLDivElement,
    maxLength: number | null
) {
    const dropdown = document.createElement("div");
    dropdown.classList.add("dropdown", "hidden");

    innerElm.appendChild(dropdown);

    const dropdownObj = new TextDropdown(
        id,
        innerElm,
        label,
        input,
        required,
        maxLength,
        dropdown,
        inputContainer,
        elm.hasAttribute("multi")
    );

    const options = elm.getAttribute("options")?.split(",");
    if (options !== undefined) {
        for (const option of options) {
            dropdownObj.createItem(option);
        }
    }

    return dropdownObj;
}

function initTextButton(id: string, elm: HTMLElement, innerElm: HTMLElement): TextButton {
    innerElm.classList.add("button");
    innerElm.innerHTML = elm.getAttribute("label") ?? "";

    if (elm.hasAttribute("danger")) {
        innerElm.classList.add("danger");
    }

    if (elm.hasAttribute("square")) {
        innerElm.classList.add("square");
    }

    return new TextButton(id, innerElm);
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