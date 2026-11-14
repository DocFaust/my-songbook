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

export function editableSongTitle(song) {
    return String(song?.title || song?.name || '');
}

export function editableSongArtist(song) {
    return song?.artist == null ? '' : String(song.artist);
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

export function isSongContentDirty({
    editing,
    isDraft,
    song,
    editedText,
    editedTitle = '',
    editedArtist = '',
}) {
    if (!editing && !isDraft) {
        return false;
    }
    const hasSong = !isDraft && song;
    const baselineText = hasSong ? (song.content || '') : '';
    const baselineTitle = hasSong ? editableSongTitle(song) : '';
    const baselineArtist = hasSong ? editableSongArtist(song) : '';
    return editedText !== baselineText
        || editedTitle !== baselineTitle
        || editedArtist !== baselineArtist;
}
