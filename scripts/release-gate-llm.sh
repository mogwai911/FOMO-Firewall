#!/usr/bin/env bash
set -euo pipefail

missing=()

if [ -z "${LLM_E2E_BASE_URL:-}" ]; then
  missing+=("LLM_E2E_BASE_URL")
fi
if [ -z "${LLM_E2E_API_KEY:-}" ]; then
  missing+=("LLM_E2E_API_KEY")
fi

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Missing required env for LLM release gate: ${missing[*]}" >&2
  exit 1
fi

if ! [[ "${LLM_E2E_BASE_URL}" =~ ^https?:// ]]; then
  echo "LLM_E2E_BASE_URL must be a valid http(s) url." >&2
  exit 1
fi

set +e
output="$(npm run test:e2e:llm 2>&1)"
status=$?
set -e

echo "$output"

if [ "$status" -ne 0 ]; then
  echo "LLM release gate failed: real LLM e2e returned non-zero." >&2
  exit "$status"
fi

if echo "$output" | rg -q "1 skipped"; then
  echo "LLM release gate failed: test was skipped unexpectedly." >&2
  exit 1
fi

if ! echo "$output" | rg -q "1 passed"; then
  echo "LLM release gate failed: expected exactly one passing spec." >&2
  exit 1
fi

echo "LLM release gate passed."
