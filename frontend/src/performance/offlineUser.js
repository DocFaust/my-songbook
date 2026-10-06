const MODE_KEY = 'mysongbook.performanceMode';
const USER_KEY = 'mysongbook.lastOfflineUserId';

export const NO_SNAPSHOT_MESSAGE = 'Performance Mode nicht verfügbar. Auf diesem Gerät wurden noch keine Offline-Daten gespeichert. Stelle einmal eine Verbindung her, damit die Banddaten geladen werden können.';

export function readPerformanceModeEnabled() {
    try {
        return window.localStorage.getItem(MODE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function writePerformanceModeEnabled(enabled) {
    if (enabled) {
        window.localStorage.setItem(MODE_KEY, 'true');
        return;
    }
    window.localStorage.removeItem(MODE_KEY);
}

export function readLastOfflineUserId() {
    try {
        const value = window.localStorage.getItem(USER_KEY);
        return typeof value === 'string' && value.length > 0 ? value : null;
    } catch {
        return null;
    }
}

export function writeLastOfflineUserId(userId) {
    if (typeof userId !== 'string' || userId.length === 0) {
        return;
    }
    window.localStorage.setItem(USER_KEY, userId);
}
