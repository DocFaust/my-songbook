import React from 'react';
import { AuthProvider } from 'react-oidc-context';
import { oidcConfig, isOidcConfigured } from './authConfig.js';
import { loadPendingInviteToken } from './inviteStorage.js';

export default function OidcAuthProvider({ children }) {
    if (!isOidcConfigured) {
        return children;
    }

    return (
        <AuthProvider
            {...oidcConfig}
            onSigninCallback={() => {
                const inviteToken = loadPendingInviteToken();
                const path = inviteToken ? `/invite/${inviteToken}` : window.location.pathname;
                window.history.replaceState({}, document.title, path);
            }}
        >
            {children}
        </AuthProvider>
    );
}
