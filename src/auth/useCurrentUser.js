import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { apiBaseUrl } from './authConfig.js';

export function useCurrentUser() {
    const auth = useAuth();
    const [currentUser, setCurrentUser] = useState(null);
    const [error, setError] = useState(null);
    const isAuthReady = auth.isAuthenticated && auth.user?.access_token;

    useEffect(() => {
        if (!isAuthReady) {
            return;
        }

        let cancelled = false;

        fetch(`${apiBaseUrl}/api/me`, {
            headers: {
                Authorization: `Bearer ${auth.user.access_token}`,
            },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                if (!cancelled) {
                    setCurrentUser(data);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setCurrentUser(null);
                    setError(err);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthReady, auth.user?.access_token]);

    return {
        currentUser: isAuthReady ? currentUser : null,
        error: isAuthReady ? error : null,
    };
}
