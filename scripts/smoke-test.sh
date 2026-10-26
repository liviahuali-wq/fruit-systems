#!/usr/bin/env bash
# Smoke tests after a deployment, and the daily keep-alive.
# Usage: scripts/smoke-test.sh <base url> <expected environment>
set -euo pipefail

base_url="${1:?base url required}"
expected_env="${2:?expected environment required}"

fail() { echo "FAIL: $*" >&2; exit 1; }

# A new deployment can take a few seconds to answer.
for attempt in 1 2 3 4 5; do
  status=$(curl -s -o /tmp/health.json -w '%{http_code}' "$base_url/api/health" || true)
  [ "$status" = "200" ] && break
  echo "health returned $status, retrying ($attempt/5)"
  sleep 5
done

[ "$status" = "200" ] || fail "/api/health returned $status: $(cat /tmp/health.json 2>/dev/null)"
grep -q '"database":"ok"' /tmp/health.json || fail "database check not ok: $(cat /tmp/health.json)"
grep -q "\"environment\":\"$expected_env\"" /tmp/health.json || fail "expected environment $expected_env: $(cat /tmp/health.json)"
echo "ok  /api/health  $(cat /tmp/health.json)"

home=$(curl -s -o /tmp/home.html -w '%{http_code}' "$base_url/")
[ "$home" = "200" ] || fail "home page returned $home"
grep -q "Fruit Systems" /tmp/home.html || fail "home page does not mention Fruit Systems"
grep -q "Environment: $expected_env" /tmp/home.html || fail "home page footer does not show environment $expected_env"
echo "ok  /  home page, footer shows $expected_env"

# The app must run in Sydney (D-03). Vercel names the serving region in this header.
region=$(curl -s -D - -o /dev/null "$base_url/api/health" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-vercel-id"{print $2}')
case "$region" in
  *syd1*) echo "ok  region  $region" ;;
  *) fail "app is not running in Sydney (x-vercel-id: ${region:-missing})" ;;
esac
