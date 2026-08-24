#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "== MASTER go-live =="
test -f package.json
test -f src/components/backend-hub.tsx
test -f src/components/quote-wizard.tsx
grep -q 'DEFAULT_JOB_GOALS' src/components/quote-wizard.tsx
grep -q 'label: "Backend"' src/components/app-shell.tsx
if [ ! -x node_modules/.bin/vite ]; then npm install; fi
exec node ./node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port 8080
