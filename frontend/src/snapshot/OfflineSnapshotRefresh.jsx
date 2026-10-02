import { useEffect, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import { refreshOfflineSnapshot } from './refreshSnapshot.js';

export default function OfflineSnapshotRefresh() {
    const auth = useAuth();
    const subject = auth.isAuthenticated ? auth.user?.profile?.sub ?? null : null;
    const token = auth.isAuthenticated ? auth.user?.access_token ?? null : null;
    const refreshedSubject = useRef(null);

    useEffect(() => {
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
        refreshOfflineSnapshot({ token }).catch((error) => {
            if (!cancelled) {
                console.error('Der Offline-Snapshot konnte nicht aktualisiert werden.', error);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [subject, token]);

    return null;
}
