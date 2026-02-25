#!/usr/bin/env sh
set -eu

# Single-user quick-start:
# when DATABASE_URL is missing, default to persisted sqlite path.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="file:/app/data/app.db"
fi

export DATABASE_URL

KEY_FILE="${APP_SETTINGS_ENCRYPTION_KEY_FILE:-/app/data/.app_settings_encryption_key}"

# Single-user quick-start:
# if key env is missing, load from persisted file or auto-generate once.
if [ -z "${APP_SETTINGS_ENCRYPTION_KEY:-}" ]; then
  if [ -f "$KEY_FILE" ]; then
    APP_SETTINGS_ENCRYPTION_KEY="$(cat "$KEY_FILE")"
  else
    APP_SETTINGS_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
    mkdir -p "$(dirname "$KEY_FILE")"
    printf "%s" "$APP_SETTINGS_ENCRYPTION_KEY" > "$KEY_FILE"
    chmod 600 "$KEY_FILE" || true
    echo "APP_SETTINGS_ENCRYPTION_KEY was auto-generated and persisted to $KEY_FILE"
  fi
fi

export APP_SETTINGS_ENCRYPTION_KEY

npx prisma generate >/dev/null
npx prisma db push --skip-generate >/dev/null
exec npm run start
