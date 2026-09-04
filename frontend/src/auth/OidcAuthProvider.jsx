import React from 'react';
import { AuthProvider } from 'react-oidc-context';
import { oidcConfig, isOidcConfigured } from './authConfig.js';

export default function OidcAuthProvider({ children }) {
    if (!isOidcConfigured) {
        return children;
    }

    return (
        <AuthProvider
            {...oidcConfig}
            onSigninCallback={() => {
                // Strip OIDC query params only. Returning to /invite/:token is
                // React Router's job (PendingInviteRedirect), not history.replaceState.
                window.history.replaceState({}, document.title, window.location.pathname);
            }}
        >
            {children}
        </AuthProvider>
    );
}
