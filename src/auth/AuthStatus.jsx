import React from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useAuth } from 'react-oidc-context';
import { isOidcConfigured } from './authConfig.js';
import { useCurrentUser } from './useCurrentUser.js';

function displayName(user) {
    const profile = user?.profile ?? {};
    return profile.preferred_username || profile.name || 'Angemeldet';
}

export default function AuthStatus() {
    const auth = useAuth();
    useCurrentUser();

    if (!isOidcConfigured) {
        return (
            <Typography variant="caption" sx={{ opacity: 0.75, mr: 1 }}>
                Auth nicht konfiguriert
            </Typography>
        );
    }

    if (auth.isLoading) {
        return (
            <Typography variant="caption" sx={{ mr: 1 }}>
                …
            </Typography>
        );
    }

    if (!auth.isAuthenticated) {
        return (
            <Button color="inherit" onClick={() => auth.signinRedirect()}>
                Anmelden
            </Button>
        );
    }

    return (
        <>
            <Typography variant="caption" sx={{ mr: 1, opacity: 0.85 }}>
                {displayName(auth.user)}
            </Typography>
            <Button color="inherit" onClick={() => auth.signoutRedirect()}>
                Abmelden
            </Button>
        </>
    );
}
