export function songTitle(song, isDraft = false) {
    if (isDraft) {
        return 'Neuer Song';
    }
    if (!song) {
        return 'Kein Song ausgewählt';
    }
    return song.title || song.name || 'Unbenannt';
}

export function songArtist(song) {
    return String(song?.artist || song?.author || '').trim();
}

export function editBlockedReason({ performanceLocked, canMutate }) {
    if (performanceLocked) {
        return 'Im Performance Mode nicht verfügbar.';
    }
    if (!canMutate) {
        return 'Mit deiner Rolle kannst du den Song nur lesen.';
    }
    return null;
}

export function isSongContentDirty({ editing, isDraft, song, editedText }) {
    if (!editing && !isDraft) {
        return false;
    }
    const baseline = isDraft || !song ? '' : (song.content || '');
    return editedText !== baseline;
}
