/* eslint-disable react-refresh/only-export-components -- hook and provider share one performance-mode context */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { ApiError } from '../api/apiClient.js';
import { refreshOfflineSnapshot } from '../snapshot/refreshSnapshot.js';
import { activatePerformanceMode, hasUsableSnapshot } from './activatePerformanceMode.js';
import { probeBackend } from './backendReachability.js';
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

export function PerformanceModeProvider({ children }) {
    const auth = useAuth();
    const token = auth.user?.access_token ?? null;
    const [active, setActive] = useState(false);
    const [ready, setReady] = useState(() => !readPerformanceModeEnabled());
    const [enabling, setEnabling] = useState(false);
    const [userId, setUserId] = useState(() => (
        readPerformanceModeEnabled() ? null : readLastOfflineUserId()
    ));
    const [revision, setRevision] = useState(0);
    const [backendAvailable, setBackendAvailable] = useState(null);
    const [unreachable, setUnreachable] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);
    const [notice, setNotice] = useState(null);
    const [conflicts, setConflicts] = useState([]);
    const [blocked, setBlocked] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);

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
        let cancelled = false;
        const enabled = readPerformanceModeEnabled();
        const storedUserId = readLastOfflineUserId();
        if (!enabled) {
            return undefined;
        }
        hasUsableSnapshot(storedUserId).then((ok) => {
            if (cancelled) {
                return;
            }
            if (ok) {
                setUserId(storedUserId);
                setActive(true);
            } else {
                writePerformanceModeEnabled(false);
                setNotice(NO_SNAPSHOT_MESSAGE);
            }
            setReady(true);
        }).catch(() => {
            if (!cancelled) {
                setReady(true);
            }
        });
        return () => {
            cancelled = true;
        };
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
