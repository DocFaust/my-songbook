import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { isOidcConfigured } from './authConfig.js';
import { loadPendingInviteToken } from './inviteStorage.js';

function invitePath(token) {
    return `/invite/${token}`;
}

function AuthenticatedInviteRedirect() {
    const auth = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const accessToken = auth.user?.access_token;
    const authReady = !auth.isLoading && Boolean(auth.isAuthenticated && accessToken);

    useEffect(() => {
        if (!authReady) {
            return;
        }
        const token = loadPendingInviteToken();
        if (!token) {
            return;
        }
        // A freshly opened /invite/:token link must win over a leftover stored
        // token. Restore after OIDC only from non-invite paths (typically /).
        if (location.pathname.startsWith('/invite/')) {
            return;
        }
        navigate(invitePath(token), { replace: true });
    }, [authReady, location.pathname, navigate]);

    return null;
}

export default function PendingInviteRedirect() {
    if (!isOidcConfigured) {
        return null;
    }
    return <AuthenticatedInviteRedirect />;
}
