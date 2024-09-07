export function setHoldClick(element: HTMLElement, callback: () => void) {
    var progressInterval: undefined | number = undefined;
    var progress = 0;

    function startProgress() {
        stopProgress();

        progressInterval = setInterval(() => {
            progress += 1;
            element.style.background = `linear-gradient(to right, var(--hazard-color), var(--hazard-color) ${progress}%, var(--hover-hazard-color) ${progress}%, var(--hover-hazard-color) 100%)`;

            if (progress === 100) {
                stopProgress();
                callback();
            }
        }, 10);
    }

    function stopProgress() {
        if (progressInterval !== undefined) {
            clearInterval(progressInterval);
            progressInterval = undefined;
            progress = 0;
            element.style.background = null;
        }
    }

    element.addEventListener("mousedown", startProgress);
    element.addEventListener("mouseleave", stopProgress);
    element.addEventListener("mouseup", stopProgress);
}