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
        const target = invitePath(token);
        if (location.pathname !== target) {
            navigate(target, { replace: true });
        }
    }, [authReady, location.pathname, navigate]);

    return null;
}

export default function PendingInviteRedirect() {
    if (!isOidcConfigured) {
        return null;
    }
    return <AuthenticatedInviteRedirect />;
}
