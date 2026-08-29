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
                window.history.replaceState({}, document.title, window.location.pathname);
            }}
        >
            {children}
        </AuthProvider>
    );
}
