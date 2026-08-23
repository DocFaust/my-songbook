const keycloakDiscoveryUrl =
    'http://localhost:8081/realms/my-songbook/.well-known/openid-configuration';
const expectedIssuer = 'http://localhost:8081/realms/my-songbook';
const backendHealthUrl = 'http://localhost:8080/actuator/health';
const backendReadinessUrl = 'http://localhost:8080/actuator/health/readiness';

async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}`);
    }
    return response.json();
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

console.log('Local stack is ready:');
console.log(`- Keycloak realm imported, issuer ${discovery.issuer}`);
console.log('- OIDC discovery endpoint reachable');
console.log('- Backend health and readiness are UP');
