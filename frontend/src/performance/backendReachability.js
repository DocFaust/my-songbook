import { apiBaseUrl } from '../auth/authConfig.js';
import { ApiError } from '../api/apiClient.js';

export function isBackendUnreachableError(error) {
    if (error instanceof ApiError) {
        return error.kind === 'network';
    }
    return error instanceof TypeError;
}

export async function probeBackend(fetchImpl = fetch) {
    try {
        const response = await fetchImpl(`${apiBaseUrl}/actuator/health`, {
            method: 'GET',
            cache: 'no-store',
        });
        return response.status < 500;
    } catch {
        return false;
    }
}
