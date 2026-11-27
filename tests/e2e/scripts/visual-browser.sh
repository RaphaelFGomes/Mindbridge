#!/usr/bin/env bash
# Starts a Playwright browser server in the official container, so screenshots render
# the same on every machine (fonts, antialiasing). The image version always matches the
# installed @playwright/test, so dependency bumps can't drift them apart.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('./node_modules/@playwright/test/package.json').version")
port=${PW_SERVER_PORT:-3100}
name=mindbridge-playwright

docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --rm --init --name "$name" \
  -p "127.0.0.1:${port}:${port}" \
  --user pwuser --workdir /home/pwuser \
  "mcr.microsoft.com/playwright:v${version}-noble" \
  /bin/sh -c "npx -y playwright@${version} run-server --port ${port} --host 0.0.0.0" >/dev/null

for _ in $(seq 1 90); do
  if curl -s -o /dev/null "http://127.0.0.1:${port}/"; then
    echo "Playwright ${version} browser server ready on ws://127.0.0.1:${port}/ (stop: docker rm -f ${name})"
    exit 0
  fi
  sleep 1
done
echo "The Playwright browser server did not start:" >&2
docker logs "$name" >&2 || true
exit 1
