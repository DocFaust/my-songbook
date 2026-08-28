const STORAGE_KEY = 'mysongbook.activeBandId';

export function loadActiveBandId() {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

export function saveActiveBandId(bandId) {
    try {
        if (bandId) {
            window.localStorage.setItem(STORAGE_KEY, bandId);
        } else {
            window.localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Ignore quota / privacy-mode failures.
    }
}
