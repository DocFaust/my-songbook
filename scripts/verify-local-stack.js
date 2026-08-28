const keycloakDiscoveryUrl =
    'http://localhost:8081/realms/my-songbook/.well-known/openid-configuration';
const expectedIssuer = 'http://localhost:8081/realms/my-songbook';
const backendHealthUrl = 'http://localhost:8080/actuator/health';
const backendReadinessUrl = 'http://localhost:8080/actuator/health/readiness';
const frontendUrl = 'http://localhost:5173';
const frontendClientRouteUrl = 'http://localhost:5173/editor';
const frontendApiMeUrl = 'http://localhost:5173/api/me';

async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}`);
    }
    return response.json();
}

async function getText(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}`);
    }
    return { status: response.status, text: await response.text() };
}

const discovery = await getJson(keycloakDiscoveryUrl);
if (discovery.issuer !== expectedIssuer) {
    throw new Error(
        `Unexpected issuer: ${discovery.issuer} (expected ${expectedIssuer})`
    );
}
if (!discovery.jwks_uri) {
    throw new Error('OIDC discovery document is missing jwks_uri');
}

const health = await getJson(backendHealthUrl);
if (health.status !== 'UP') {
    throw new Error(`Backend health is ${health.status}`);
}

const readiness = await getJson(backendReadinessUrl);
if (readiness.status !== 'UP') {
    throw new Error(`Backend readiness is ${readiness.status}`);
}

const frontendHome = await getText(frontendUrl);
if (!frontendHome.text.includes('<div id="root">')) {
    throw new Error('Frontend did not serve the SPA index.html');
}

const frontendRoute = await getText(frontendClientRouteUrl);
if (!frontendRoute.text.includes('<div id="root">')) {
    throw new Error('Frontend client-side route did not fall back to index.html');
}

const apiThroughFrontend = await fetch(frontendApiMeUrl);
if (apiThroughFrontend.status !== 401) {
    throw new Error(
        `Unauthenticated /api/me through nginx returned HTTP ${apiThroughFrontend.status} (expected 401)`
    );
}

console.log('Local stack is ready:');
console.log(`- Keycloak realm imported, issuer ${discovery.issuer}`);
console.log('- OIDC discovery endpoint reachable');
console.log('- Backend health and readiness are UP');
console.log('- Frontend container serves the SPA (including /editor fallback)');
console.log('- nginx proxies /api to the backend (unauthenticated /api/me → 401)');
