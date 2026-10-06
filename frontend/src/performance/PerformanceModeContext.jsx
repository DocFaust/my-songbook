/* eslint-disable react-refresh/only-export-components -- hook and provider share one performance-mode context */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { ApiError, apiRequest } from '../api/apiClient.js';
import { refreshOfflineSnapshot } from '../snapshot/refreshSnapshot.js';
import { activatePerformanceMode, hasUsableSnapshot } from './activatePerformanceMode.js';
import { isBackendUnreachableError, probeBackend } from './backendReachability.js';
import {
    NO_SNAPSHOT_MESSAGE,
    readLastOfflineUserId,
    readPerformanceModeEnabled,
    writePerformanceModeEnabled,
} from './offlineUser.js';
import { listPendingNotes } from './pendingNotes.js';
import { syncPendingNotes } from './syncPendingNotes.js';

const PerformanceModeContext = createContext(null);

const inactivePerformanceMode = {
    active: false,
    ready: true,
    enabling: false,
    userId: null,
    revision: 0,
    backendAvailable: null,
    unreachable: false,
    offlineReady: false,
    notice: null,
    conflicts: [],
    blocked: [],
    pendingCount: 0,
    enable: async () => ({ ok: false, reason: 'unavailable' }),
    disable: async () => ({ ok: false, reason: 'unavailable' }),
    reportUnreachable: () => {},
    refreshPending: async () => {},
    dismissNotice: () => {},
};

export function usePerformanceMode() {
    return useContext(PerformanceModeContext) ?? inactivePerformanceMode;
}

function splitPending(pending) {
    return {
        conflicts: pending.filter((change) => change.conflict && !change.blocked),
        blocked: pending.filter((change) => Boolean(change.blocked)),
        pendingCount: pending.length,
    };
}

async function signedInUserId(token) {
    const me = await apiRequest({ path: '/api/me', token });
    return typeof me?.id === 'string' && me.id.length > 0 ? me.id : null;
}

export function PerformanceModeProvider({ children }) {
    const auth = useAuth();
    const token = auth.user?.access_token ?? null;
    const [active, setActive] = useState(() => readPerformanceModeEnabled());
    const [ready, setReady] = useState(() => !readPerformanceModeEnabled());
    const [enabling, setEnabling] = useState(false);
    const [userId, setUserId] = useState(null);
    const [revision, setRevision] = useState(0);
    const [backendAvailable, setBackendAvailable] = useState(null);
    const [unreachable, setUnreachable] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);
    const [notice, setNotice] = useState(null);
    const [conflicts, setConflicts] = useState([]);
    const [blocked, setBlocked] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [identityEpoch, setIdentityEpoch] = useState(0);
    const identityRetries = useRef(0);

    const applyPending = useCallback((pending) => {
        const next = splitPending(pending);
        setConflicts(next.conflicts);
        setBlocked(next.blocked);
        setPendingCount(next.pendingCount);
    }, []);

    const refreshPending = useCallback(async (id = userId) => {
        if (!id) {
            applyPending([]);
            return [];
        }
        const pending = await listPendingNotes(id);
        applyPending(pending);
        return pending;
    }, [applyPending, userId]);

    useEffect(() => {
        if (auth.isLoading) {
            return undefined;
        }
        let cancelled = false;

        async function bindSignedInUser() {
            if (!token) {
                if (!cancelled && !readPerformanceModeEnabled()) {
                    setUserId(null);
                    applyPending([]);
                }
                return;
            }
            let id;
            try {
                id = await signedInUserId(token);
            } catch (error) {
                if (!cancelled && isBackendUnreachableError(error) && identityRetries.current < 2) {
                    identityRetries.current += 1;
                    window.setTimeout(() => {
                        if (!cancelled) {
                            setIdentityEpoch((value) => value + 1);
                        }
                    }, 0);
                }
                return;
            }
            if (cancelled || readPerformanceModeEnabled() || !id) {
                return;
            }
            identityRetries.current = 0;
            setUserId((current) => {
                if (current !== id) {
                    applyPending([]);
                }
                return id;
            });
        }

        function leaveStoredMode(nextUserId) {
            if (readPerformanceModeEnabled()) {
                writePerformanceModeEnabled(false);
                setActive(false);
            }
            setUserId(nextUserId);
            applyPending([]);
            setReady(true);
        }

        async function signedInUserMatches(storedUserId) {
            if (!token) {
                return true;
            }
            let signedInId;
            try {
                signedInId = await signedInUserId(token);
            } catch (error) {
                if (error instanceof ApiError && (error.kind === 'unauthorized' || error.kind === 'forbidden')) {
                    if (!cancelled) {
                        leaveStoredMode(null);
                    }
                    return false;
                }
                return !cancelled;
            }
            if (cancelled || signedInId === storedUserId) {
                return !cancelled;
            }
            leaveStoredMode(signedInId);
            return false;
        }

        async function restoreStoredMode() {
            const storedUserId = readLastOfflineUserId();
            if (!await signedInUserMatches(storedUserId)) {
                return;
            }
            let ok;
            try {
                ok = await hasUsableSnapshot(storedUserId);
            } catch {
                ok = false;
            }
            if (cancelled || !readPerformanceModeEnabled()) {
                if (!cancelled) {
                    setReady(true);
                }
                return;
            }
            if (ok) {
                setUserId(storedUserId);
                setActive(true);
            } else {
                writePerformanceModeEnabled(false);
                setActive(false);
                setNotice(NO_SNAPSHOT_MESSAGE);
            }
            setReady(true);
        }

        const settle = readPerformanceModeEnabled() ? restoreStoredMode() : bindSignedInUser();
        settle.catch(() => {
            if (!cancelled) {
                setReady(true);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [applyPending, auth.isLoading, identityEpoch, token]);

    useEffect(() => {
        const retry = () => {
            identityRetries.current = 0;
            setIdentityEpoch((value) => value + 1);
        };
        window.addEventListener('online', retry);
        return () => window.removeEventListener('online', retry);
    }, []);

    useEffect(() => {
        if (!userId) {
            return undefined;
        }
        let cancelled = false;
        listPendingNotes(userId).then((pending) => {
            if (!cancelled) {
                applyPending(pending);
            }
        }).catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [userId, revision, applyPending]);

    useEffect(() => {
        if (!active) {
            return undefined;
        }
        let cancelled = false;
        const check = () => {
            probeBackend().then((ok) => {
                if (!cancelled) {
                    setBackendAvailable(ok);
                }
            }).catch(() => {
                if (!cancelled) {
                    setBackendAvailable(false);
                }
            });
        };
        check();
        window.addEventListener('online', check);
        return () => {
            cancelled = true;
            window.removeEventListener('online', check);
        };
    }, [active]);

    const enable = useCallback(async () => {
        setEnabling(true);
        setNotice(null);
        try {
            const result = await activatePerformanceMode({
                token,
                refreshSnapshot: (activeToken) => refreshOfflineSnapshot({ token: activeToken }),
            });
            if (!result.ok) {
                setNotice(NO_SNAPSHOT_MESSAGE);
                return result;
            }
            writePerformanceModeEnabled(true);
            setUserId(result.userId);
            setActive(true);
            setUnreachable(false);
            setRevision((value) => value + 1);
            return result;
        } finally {
            setEnabling(false);
        }
    }, [token]);

    const disable = useCallback(async () => {
        if (!token) {
            setNotice('Zum Synchronisieren bitte anmelden. Performance Mode bleibt aktiv.');
            return { ok: false, reason: 'auth' };
        }
        setEnabling(true);
        try {
            let signedInId;
            try {
                signedInId = await signedInUserId(token);
            } catch (error) {
                if (isBackendUnreachableError(error)) {
                    setNotice('Die Verbindung ist während der Synchronisation abgebrochen. Bereits übertragene Notizen sind gespeichert, der Rest bleibt lokal.');
                    return { ok: false, reason: 'network' };
                }
                throw error;
            }
            if (signedInId !== userId) {
                writePerformanceModeEnabled(false);
                setActive(false);
                setUserId(signedInId);
                applyPending([]);
                setNotice(null);
                return { ok: true };
            }
            const result = await syncPendingNotes({ userId, token });
            applyPending(await listPendingNotes(userId));
            if (result.networkFailed) {
                setNotice('Die Verbindung ist während der Synchronisation abgebrochen. Bereits übertragene Notizen sind gespeichert, der Rest bleibt lokal.');
                return { ok: false, reason: 'network', ...result };
            }
            writePerformanceModeEnabled(false);
            setActive(false);
            setBackendAvailable(null);
            setNotice(null);
            return { ok: true, ...result };
        } catch (error) {
            if (error instanceof ApiError && (error.kind === 'unauthorized' || error.kind === 'forbidden')) {
                setNotice('Die Notizen konnten nicht synchronisiert werden. Bitte erneut anmelden.');
                return { ok: false, reason: 'auth' };
            }
            setNotice('Die Synchronisation ist fehlgeschlagen. Die lokalen Notizen bleiben erhalten.');
            return { ok: false, reason: 'error' };
        } finally {
            setEnabling(false);
        }
    }, [applyPending, token, userId]);

    const reportUnreachable = useCallback(() => {
        if (active) {
            return;
        }
        setUnreachable(true);
        hasUsableSnapshot(readLastOfflineUserId()).then(setOfflineReady).catch(() => setOfflineReady(false));
    }, [active]);

    const dismissNotice = useCallback(() => setNotice(null), []);

    const value = useMemo(() => ({
        active,
        ready,
        enabling,
        userId,
        revision,
        backendAvailable,
        unreachable,
        offlineReady,
        notice,
        conflicts,
        blocked,
        pendingCount,
        enable,
        disable,
        reportUnreachable,
        refreshPending,
        dismissNotice,
    }), [
        active,
        ready,
        enabling,
        userId,
        revision,
        backendAvailable,
        unreachable,
        offlineReady,
        notice,
        conflicts,
        blocked,
        pendingCount,
        enable,
        disable,
        reportUnreachable,
        refreshPending,
        dismissNotice,
    ]);

    return (
        <PerformanceModeContext.Provider value={value}>
            {children}
        </PerformanceModeContext.Provider>
    );
}
