import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiRequest, ApiError, apiErrorMessage, isApiErrorKind } from '../apiClient.js';

vi.mock('../../auth/authConfig.js', () => ({
    apiBaseUrl: 'http://localhost:8080',
}));

function jsonResponse(status, body, ok = status >= 200 && status < 300) {
    return {
        ok,
        status,
        headers: {
            get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(body),
    };
}

describe('apiClient', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sendet Token und JSON und liefert die Antwort', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { id: 's1' }))));

        const result = await apiRequest({
            method: 'POST',
            path: '/api/bands/band-a/songs',
            token: 'tok',
            body: { title: 'A', artist: '', content: 'x' },
        });

        expect(result).toEqual({ id: 's1' });
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/bands/band-a/songs',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    Authorization: 'Bearer tok',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: 'A', artist: '', content: 'x' }),
            })
        );
    });

    it('unterscheidet 401, 403, 404, 409 und 410', async () => {
        const cases = [
            [401, 'unauthorized'],
            [403, 'forbidden'],
            [404, 'not_found'],
            [409, 'conflict'],
            [410, 'gone'],
        ];

        for (const [status, kind] of cases) {
            vi.stubGlobal('fetch', vi.fn(() =>
                Promise.resolve(jsonResponse(status, { error: 'stale version' }, false))
            ));
            try {
                await apiRequest({ path: '/api/x', token: 'tok' });
                throw new Error('expected failure');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect(error.status).toBe(status);
                expect(error.kind).toBe(kind);
                expect(isApiErrorKind(error, kind)).toBe(true);
            }
        }
    });

    it('meldet Netzwerkfehler gesondert', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));

        await expect(apiRequest({ path: '/api/x', token: 'tok' }))
            .rejects.toMatchObject({ kind: 'network', status: 0 });
        expect(apiErrorMessage(new ApiError(0, 'network', 'Keine Verbindung zum Server.')))
            .toBe('Keine Verbindung zum Server.');
    });

    it('wirft 401 ohne Token und ruft fetch nicht auf', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(apiRequest({ path: '/api/x' })).rejects.toMatchObject({
            kind: 'unauthorized',
            status: 401,
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('behandelt 204 ohne JSON-Body', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            ok: true,
            status: 204,
            headers: { get: () => null },
            json: () => Promise.reject(new Error('no body')),
        })));

        await expect(apiRequest({
            method: 'DELETE',
            path: '/api/bands/band-a/setlists/sl1',
            token: 'tok',
            query: { version: 3 },
        })).resolves.toBeNull();
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/bands/band-a/setlists/sl1?version=3',
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    it('liefert verständliche Meldungen für die bekannten Fehlerarten', () => {
        expect(apiErrorMessage(new ApiError(403, 'forbidden', 'x')))
            .toMatch(/Rolle/i);
        expect(apiErrorMessage(new ApiError(409, 'conflict', 'stale version')))
            .toMatch(/zwischenzeitlich/i);
        expect(apiErrorMessage(new ApiError(410, 'gone', 'Invitation expired')))
            .toMatch(/abgelaufen/i);
        expect(apiErrorMessage(new Error('other'))).toMatch(/fehlgeschlagen/i);
    });
});
