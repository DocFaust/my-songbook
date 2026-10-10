function songSearchText(song) {
    return [song?.title, song?.name, song?.artist, song?.author]
        .filter((value) => value != null && String(value).length > 0)
        .join(" ")
        .toLowerCase();
}

export function filterSongs(songs, query) {
    const list = Array.isArray(songs) ? songs : [];
    const needle = String(query ?? "").trim().toLowerCase();
    if (!needle) {
        return list;
    }
    return list.filter((song) => songSearchText(song).includes(needle));
}
