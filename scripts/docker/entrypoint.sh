#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if [ -z "${APP_SETTINGS_ENCRYPTION_KEY:-}" ]; then
  echo "APP_SETTINGS_ENCRYPTION_KEY is required." >&2
  exit 1
fi

npx prisma db push --skip-generate >/dev/null
exec npm run start
