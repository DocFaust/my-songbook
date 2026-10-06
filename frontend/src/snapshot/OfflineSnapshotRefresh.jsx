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

    useEffect(() => {
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
            shouldContinue: () => !cancelled,
        }).catch((error) => {
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
