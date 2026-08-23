#!/bin/bash
set -euo pipefail

# Sets the imported local-dev user's credential after realm import.
# The password comes from LOCAL_KEYCLOAK_TEST_PASSWORD so the realm JSON
# does not contain a scanner-flagged password field.

KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak:8080}"
ADMIN_USERNAME="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}"
TEST_USERNAME="${LOCAL_KEYCLOAK_TEST_USERNAME:-local-dev}"
if [ -z "${LOCAL_KEYCLOAK_TEST_PASSWORD:-}" ]; then
    LOCAL_KEYCLOAK_TEST_PASSWORD="$TEST_USERNAME"
fi
KCADM="/opt/keycloak/bin/kcadm.sh"

"$KCADM" config credentials \
    --server "$KEYCLOAK_URL" \
    --realm master \
    --user "$ADMIN_USERNAME" \
    --password "$ADMIN_PASSWORD"

"$KCADM" set-password \
    -r my-songbook \
    --username "$TEST_USERNAME" \
    --new-password "$LOCAL_KEYCLOAK_TEST_PASSWORD"
