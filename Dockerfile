# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
RUN npm ci --ignore-scripts

COPY index.html vite.config.js ./
COPY public public
COPY src src

# Vite inlines VITE_* at build time. Empty API base URL means same-origin
# relative /api/... calls, which nginx proxies to the backend service.
ARG VITE_OIDC_ISSUER=http://localhost:8081/realms/my-songbook
ARG VITE_OIDC_CLIENT_ID=my-songbook-spa
ARG VITE_API_BASE_URL=
RUN printf '%s\n' \
    "VITE_OIDC_ISSUER=${VITE_OIDC_ISSUER}" \
    "VITE_OIDC_CLIENT_ID=${VITE_OIDC_CLIENT_ID}" \
    "VITE_API_BASE_URL=${VITE_API_BASE_URL}" \
    > .env.production \
    && npm run build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
