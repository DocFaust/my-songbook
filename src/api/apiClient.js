import { apiBaseUrl } from '../auth/authConfig.js';

export class ApiError extends Error {
    constructor(status, kind, message, body = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.kind = kind;
        this.body = body;
    }
}

function kindFromStatus(status) {
    if (status === 401) {
        return 'unauthorized';
    }
    if (status === 403) {
        return 'forbidden';
    }
    if (status === 404) {
        return 'not_found';
    }
    if (status === 409) {
        return 'conflict';
    }
    return 'server';
}

export function isApiErrorKind(error, kind) {
    return error instanceof ApiError && error.kind === kind;
}

export function apiErrorMessage(error) {
    if (!(error instanceof ApiError)) {
        return 'Die Anfrage ist fehlgeschlagen.';
    }
    switch (error.kind) {
        case 'unauthorized':
            return 'Bitte erneut anmelden.';
        case 'forbidden':
            return 'Diese Aktion ist für deine Rolle in der Band nicht erlaubt.';
        case 'not_found':
            return 'Der Eintrag wurde nicht gefunden oder ist nicht zugänglich.';
        case 'conflict':
            return 'Der Eintrag wurde zwischenzeitlich geändert.';
        case 'network':
            return 'Keine Verbindung zum Server.';
        default:
            return error.message || 'Der Server hat die Anfrage nicht verarbeitet.';
    }
}

export async function apiRequest({ method = 'GET', path, token, body, query } = {}) {
    if (!token) {
        throw new ApiError(401, 'unauthorized', 'Nicht angemeldet');
    }

    let url = `${apiBaseUrl}${path}`;
    if (query && Object.keys(query).length > 0) {
        const params = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.set(key, String(value));
            }
        });
        url = `${url}?${params.toString()}`;
    }

    let response;
    try {
        response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new ApiError(0, 'network', 'Keine Verbindung zum Server.');
    }

    if (response.status === 204) {
        return null;
    }

    if (!response.ok) {
        let parsed = null;
        try {
            parsed = await response.json();
        } catch {
            // Antwort ohne JSON-Body bleibt null.
        }
        const kind = kindFromStatus(response.status);
        const message = parsed?.error || `API-Fehler ${response.status}`;
        throw new ApiError(response.status, kind, message, parsed);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }
    return null;
}
