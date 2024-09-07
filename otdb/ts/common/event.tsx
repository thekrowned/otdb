import { getElementByIdOrThrow } from "./util";
import jsx from "../jsxFactory";

type EventType = "info" | "error";

export class EventManager {
    private eventContainer: HTMLDivElement;

    public constructor() {
        this.eventContainer = getElementByIdOrThrow("event-container") as HTMLDivElement;
    }

    private send(msg: string, type: EventType = "info") {
        const bar = <hr class={`event-bar ${type}`}/> as HTMLHRElement;
        const event = (
            <div class={`event ${type}`}>
                <p class="event-description">{msg}</p>
                {bar}
            </div>
        ) as HTMLDivElement;

        var width = 1000;
        var interval = setInterval(() => {
            width -= 1;
            bar.style.width = `${width/10}%`;

            if (width === 0) endEvent();
        }, 10);

        function endEvent() {
            clearInterval(interval);
            event.remove();
        }

        event.addEventListener("click", endEvent);
        
        this.eventContainer.append(event);
    }

    public info(msg: string) {
        this.send(msg, "info");
    }

    public error(msg: string) {
        this.send(msg, "error");
    }
}