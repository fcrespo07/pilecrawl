# Block Rogue: el juego y el servidor del ranking en una sola imagen.
#   docker buildx build --platform linux/arm64 -t blockrogue:local .
# Etapa 1: compila el juego (Vite) y el servidor (esbuild).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* se queda dentro del JavaScript del navegador: solo valores públicos
ARG VITE_RANKING=1
ARG VITE_AD_PROVIDER=
ARG VITE_AD_CLIENT=
ARG VITE_AD_SLOT=
ARG VITE_AD_CONSENT=
ARG VITE_PRIVACY_URL=
ENV VITE_RANKING=$VITE_RANKING VITE_AD_PROVIDER=$VITE_AD_PROVIDER VITE_AD_CLIENT=$VITE_AD_CLIENT VITE_AD_SLOT=$VITE_AD_SLOT VITE_AD_CONSENT=$VITE_AD_CONSENT VITE_PRIVACY_URL=$VITE_PRIVACY_URL
RUN npm run build && npm run build:server

# Etapa 2: solo lo necesario para ejecutar. Node 22 lleva SQLite dentro: no hay dependencias nativas.
FROM node:22-alpine
ENV NODE_ENV=production STATIC_DIR=/app/dist DB_PATH=/data/blockrogue.db BACKUP_DIR=/data/backups PORT=8787 TRUST_PROXY=1
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server/server.mjs ./server.mjs
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
