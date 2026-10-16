#!/bin/sh
# Runs as root only long enough to make the mounted volumes writable by the
# unprivileged `node` user, then drops privileges and execs the service.
#
# Sessions/logs arrive as host bind mounts that previous (root) deployments may
# have left root-owned, so fixing ownership at startup keeps `USER node` safe
# across upgrades (CIS Docker 4.1).
set -e

mkdir -p "$SESSIONS_DIR" "$(dirname "$LOG_FILE")"
chown -R node:node "$SESSIONS_DIR" "$(dirname "$LOG_FILE")"

exec su-exec node "$@"
