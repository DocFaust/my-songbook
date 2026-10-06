import { useEffect, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import { usePerformanceMode } from '../performance/PerformanceModeContext.jsx';
import { refreshOfflineSnapshot } from './refreshSnapshot.js';

export default function OfflineSnapshotRefresh() {
    const auth = useAuth();
    const performance = usePerformanceMode();
    const subject = auth.isAuthenticated ? auth.user?.profile?.sub ?? null : null;
    const token = auth.isAuthenticated ? auth.user?.access_token ?? null : null;
    const refreshedSubject = useRef(null);
    const modeActive = useRef(false);

    useEffect(() => {
        modeActive.current = performance.active;
        if (performance.active) {
            return undefined;
        }
        if (!subject || !token) {
            if (!subject) {
                refreshedSubject.current = null;
            }
            return undefined;
        }
        if (refreshedSubject.current === subject) {
            return undefined;
        }
        refreshedSubject.current = subject;

        let cancelled = false;
        refreshOfflineSnapshot({
            token,
            shouldContinue: () => !modeActive.current,
        }).then((result) => {
            if (result?.aborted && refreshedSubject.current === subject) {
                refreshedSubject.current = null;
            }
        }).catch((error) => {
            if (refreshedSubject.current === subject) {
                refreshedSubject.current = null;
            }
            if (!cancelled) {
                console.error('Der Offline-Snapshot konnte nicht aktualisiert werden.', error);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [subject, token, performance.active]);

    return null;
}
