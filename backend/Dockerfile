FROM node:22-alpine AS build
WORKDIR /app

ARG APP_VERSION=0.0.0-dev
ENV APP_VERSION=$APP_VERSION

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ARG APP_VERSION=0.0.0-dev
ENV APP_VERSION=$APP_VERSION
ENV NODE_OPTIONS=--no-node-snapshot
RUN apk add --no-cache tini
COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package-lock.json* /app/

# Run as the unprivileged image user (CIS Docker 4.1). The backend needs no
# capabilities: it binds an unprivileged port and stores files in S3.
USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
EXPOSE 3001
