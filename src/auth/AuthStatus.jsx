import React from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useAuth } from 'react-oidc-context';
import { isOidcConfigured } from './authConfig.js';
import { useCurrentUser } from './useCurrentUser.js';

export default function AuthStatus() {
    if (!isOidcConfigured) {
        return (
            <Typography variant="caption" sx={{ opacity: 0.75, mr: 1 }}>
                Auth nicht konfiguriert
            </Typography>
        );
    }

    return <ConfiguredAuthStatus />;
}

function ConfiguredAuthStatus() {
    const auth = useAuth();
    const { currentUser } = useCurrentUser();

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
            {currentUser?.id && (
                <Typography variant="caption" sx={{ mr: 1, opacity: 0.85 }}>
                    User {currentUser.id}
                </Typography>
            )}
            <Button color="inherit" onClick={() => auth.signoutRedirect()}>
                Abmelden
            </Button>
        </>
    );
}
