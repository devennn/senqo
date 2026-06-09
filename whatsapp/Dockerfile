FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app/package-lock.json* /app/

RUN npm ci --omit=dev && npm cache clean --force

# Auth state persists here (mount a volume).
RUN mkdir -p /app/sessions /app/logs
ENV SESSIONS_DIR=/app/sessions
ENV LOG_FILE=/app/logs/whatsapp.log

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
EXPOSE 8080
