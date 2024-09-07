import { getElementByIdOrThrow, removeChildren } from "./util";

function createPageNumbers(currentPage: number, totalPages: number) {
    const pageNums: Array<number | null> = [];
    currentPage = Math.min(currentPage, totalPages);

    pageNums.push(1);
    if (currentPage > 6) {
        pageNums.push(null);
    }

    const min = Math.max(currentPage-4, 2);
    const max = Math.min(currentPage+4, totalPages);
    for (let i=min; i<=max; i++) {
        pageNums.push(i);
    }

    if (max != totalPages) {
        if (max < totalPages-1) {
            pageNums.push(null);
        }
        pageNums.push(totalPages);
    }

    return pageNums;
}

/**
 * Create page navigation bar
 * 
 * @param currentPage - starting active page
 * @param totalPages - total number of pages to show
 * @param callback - callback when a page item is clicked. Can be paired with onPageClick.
 */
export function createPageNavigator(currentPage: number, totalPages: number, callback: (MouseEvent) => any) {
    const navigator = getElementByIdOrThrow("page-navigator");
    removeChildren(navigator);

    const pageNums = createPageNumbers(currentPage, totalPages);
    for (const page of pageNums) {
        const container = document.createElement("div");
        if (page !== null) {
            container.id = `page-${page}`;
            if (page == currentPage) {
                container.classList.add("active");
            } else {
                container.addEventListener("click", callback);
            }
            container.classList.add("page-button");
            container.innerHTML = page.toString();
        } else {
            container.innerHTML = "...";
        }
        navigator.appendChild(container);
    }
}

/**
 * Call from page click event to update the elements and get new page
 * 
 * @param evt - click event
 * @param currentPage - current stored page value
 * @returns new page value
 */
export function onPageClick(evt: MouseEvent, currentPage: number | string) {
    document.getElementById(`page-${currentPage}`).classList.remove("active");
    const pageElm = evt.target as Element;
    pageElm.classList.add("active");
    return parseInt(pageElm.innerHTML);
}