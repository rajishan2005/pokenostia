#!/bin/sh
set -e

# Railway injects PORT; default 3000 locally
export PORT="${PORT:-3000}"
export HOSTNAME="0.0.0.0"

# SQLite path (volume should mount at /data)
export DATABASE_URL="${DATABASE_URL:-file:/data/holovault.db}"

echo "[entrypoint] PORT=$PORT DATABASE_URL=$DATABASE_URL"

# Ensure data dir exists and is writable (volume mounts often as root)
mkdir -p /data
# If we are root, fix ownership for the app user
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs /data 2>/dev/null || true
  chmod 777 /data 2>/dev/null || true
fi

echo "[entrypoint] Running prisma db push..."
# Don't kill the container if push fails once — try then start anyway with retry
if ! npx prisma db push --skip-generate --accept-data-loss 2>&1; then
  echo "[entrypoint] prisma db push failed, retrying in 2s..."
  sleep 2
  npx prisma db push --skip-generate 2>&1 || echo "[entrypoint] prisma push still failing — starting app anyway"
fi

echo "[entrypoint] Starting Next.js on 0.0.0.0:$PORT"
exec npx next start -H 0.0.0.0 -p "$PORT"
