import { InputManager } from "./form"
import { EventManager } from "./event";
import { APIManager } from "./api";
import { getElementByIdOrThrow } from "./util";
import jsx from "../jsxFactory";

export class ElementsManager {
    public inputs: InputManager;
    public backdrop: BackdropManager;
    public event: EventManager;
    public api: APIManager;
    public popup: PopupManager;

    public constructor() {
        this.inputs = new InputManager();
        this.backdrop = new BackdropManager();
        this.event = new EventManager();
        this.api = new APIManager(this.event);
        this.popup = new PopupManager(this.backdrop);
    }
}

export class BackdropManager {
    private backdrop: HTMLDivElement;

    public constructor() {
        this.backdrop = getElementByIdOrThrow("backdrop") as HTMLDivElement;
    }

    /**
     * Shows the backdrop
     *
     * @param level - level to place the backdrop behind (header, or popup)
     */
    public show(level: "header" | "popup") {
        this.backdrop.className = "backdrop-level-"+level;
    }

    /**
     * Hides the backdrop
     */
    public hide() {
        this.backdrop.className = "hide";
    }

    /**
     * Adds a callback to occur on a certain event
     * 
     * @param callback - Event callback
     * @param type - Event to listen for
     */
    public addCallback(callback: (MouseEvent) => void, type: string = "click") {
        this.backdrop.addEventListener(type, callback);
    }
}

export class PopupManager {
    private backdrop: BackdropManager;
    private popup: HTMLDivElement;

    public constructor(backdrop: BackdropManager) {
        this.backdrop = backdrop;
        this.popup = getElementByIdOrThrow("popup") as HTMLDivElement;
        
        this.backdrop.addCallback(() => this.close());
    }

    /**
     * Set children of the popup from a title.
     * Creates an Ok and Cancel option.
     * 
     * @param title - Title of the popup
     * @param callback - Callback when an option is picked
     */
    public setPrompt(title: string, callback: (ok: boolean, evt: MouseEvent) => void) {
        const titleElm = <p>{title}</p>;
        const okBtn = <div class="clickable">Ok</div>;
        const cancelBtn = <div class="clickable hazard">Cancel</div>;

        okBtn.addEventListener("click", (evt: MouseEvent) => callback(true, evt));
        okBtn.addEventListener("click", () => this.close());
        cancelBtn.addEventListener("click", (evt: MouseEvent) => callback(false, evt));
        cancelBtn.addEventListener("click", () => this.close());

        this.setPromptCustom(titleElm, okBtn, cancelBtn);
    }

    /**
     * Set children of the popup
     * 
     * @param children - Children appended to the prompt
     */
    public setPromptCustom(...children: Node[]) {
        this.popup.innerHTML = "";
        this.popup.append(...children);
    }

    /**
     * Show popup and backdrop
     */
    public open() {
        this.show();
        this.backdrop.show("popup");
    }

    /**
     * Hide popup and backdrop
     */
    public close() {
        this.hide();
        this.backdrop.hide();
    }

    /**
     * Show popup
     */
    public show() {
        this.popup.classList.remove("hidden");
    }

    /**
     * Hide popup
     */
    public hide() {
        this.popup.classList.add("hidden");
    }
}