import jsx from "../jsxFactory";

export function createListingItem(id: number, title: string, favoriteCount: number, dbName: string, extra: null | string = null) {
    return (
        <div class="listing-item-container">
            <a href={`/db/${dbName}/${id}`}>
                <p class="listing-item-title">{title}</p>
            </a>
            <hr></hr>
            <div class="listing-item-info">
                <img class="favorites-cnt-star" src="/static/assets/svg/favorites.svg"></img>
                <p class="listing-item-info-data">{favoriteCount.toString()}</p>
                <div style="flex-grow: 1;"></div>
                {extra  === null ? "" : <p class="listing-item-info-data right">{extra}</p>}
            </div>
        </div>
    );
}