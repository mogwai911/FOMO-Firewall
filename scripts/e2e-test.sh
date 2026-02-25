#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEB_DIR="$ROOT_DIR/.local/debs"
LIB_ROOT="$ROOT_DIR/.local/pw-libs"
LIB_DIR="$LIB_ROOT/usr/lib/x86_64-linux-gnu"

need_lib() {
  local path="$1"
  [[ ! -f "$path" ]]
}

download_and_extract_deb() {
  local pattern="$1"
  local deb
  deb=$(ls "$DEB_DIR"/$pattern 2>/dev/null | head -n 1 || true)
  if [[ -z "$deb" ]]; then
    return 1
  fi
  dpkg-deb -x "$deb" "$LIB_ROOT"
}

ensure_playwright_runtime_libs() {
  if ! need_lib "$LIB_DIR/libnspr4.so" && ! need_lib "$LIB_DIR/libnss3.so" && ! need_lib "$LIB_DIR/libasound.so.2"; then
    return 0
  fi

  mkdir -p "$DEB_DIR" "$LIB_ROOT"

  (
    cd "$DEB_DIR"
    apt download libnspr4 libnss3 >/dev/null
    apt download libasound2t64 libasound2-data >/dev/null || \
      apt download libasound2t64=1.2.11-1build2 libasound2-data=1.2.11-1build2 >/dev/null
  )

  download_and_extract_deb "libnspr4_*_amd64.deb" || true
  download_and_extract_deb "libnss3_*_amd64.deb" || true
  download_and_extract_deb "libasound2t64_*_amd64.deb" || true
  download_and_extract_deb "libasound2-data_*_all.deb" || true
}

ensure_playwright_runtime_libs

if [[ -d "$LIB_DIR" ]]; then
  export LD_LIBRARY_PATH="$LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

cd "$ROOT_DIR"

E2E_DATABASE_URL="$(node -e "const { resolveE2EDatabaseUrl } = require('./scripts/e2e-db-url.js'); process.stdout.write(resolveE2EDatabaseUrl(process.env));")"
export DATABASE_URL="$E2E_DATABASE_URL"

if [[ "$DATABASE_URL" == file:./* ]]; then
  DB_REL_PATH="${DATABASE_URL#file:}"
  DB_FILE_PATH="$ROOT_DIR/prisma/${DB_REL_PATH#./}"
  DB_DIR_PATH="$(dirname "$DB_FILE_PATH")"
  mkdir -p "$DB_DIR_PATH"
  if [[ ! -f "$DB_FILE_PATH" ]]; then
    TEMPLATE_DB="$ROOT_DIR/prisma/dev.db"
    if [[ -f "$TEMPLATE_DB" ]]; then
      cp "$TEMPLATE_DB" "$DB_FILE_PATH"
    else
      : > "$DB_FILE_PATH"
    fi
  fi
fi

npx prisma db push --skip-generate >/dev/null

exec npx playwright test "$@"
