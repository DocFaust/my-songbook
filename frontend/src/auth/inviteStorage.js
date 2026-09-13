const STORAGE_KEY = 'mysongbook.pendingInviteToken';

export function savePendingInviteToken(token) {
    if (typeof window === 'undefined' || !token) {
        return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, token);
}

export function loadPendingInviteToken() {
    if (typeof window === 'undefined') {
        return null;
    }
    return window.sessionStorage.getItem(STORAGE_KEY);
}

export function clearPendingInviteToken() {
    if (typeof window === 'undefined') {
        return;
    }
    window.sessionStorage.removeItem(STORAGE_KEY);
}
