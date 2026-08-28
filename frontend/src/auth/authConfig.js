const authority = import.meta.env.VITE_OIDC_ISSUER;
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;

export const oidcConfig = {
    authority,
    client_id: clientId,
    redirect_uri: typeof window !== 'undefined' ? window.location.origin : '',
    post_logout_redirect_uri: typeof window !== 'undefined' ? window.location.origin : '',
    scope: 'openid',
};

export const isOidcConfigured = Boolean(authority && clientId);

// Empty string means same-origin relative /api calls (containerized nginx proxy).
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
