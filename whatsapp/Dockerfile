FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tini su-exec
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app/package-lock.json* /app/

RUN npm ci --omit=dev && npm cache clean --force

# Auth state persists here (mount a volume).
RUN mkdir -p /app/sessions /app/logs
ENV SESSIONS_DIR=/app/sessions
ENV LOG_FILE=/app/logs/whatsapp.log

# The entrypoint fixes mount ownership while root, then drops to the unprivileged
# `node` user before starting the service (CIS Docker 4.1).
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
EXPOSE 8080
