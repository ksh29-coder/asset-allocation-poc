#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

case "${1:-serve}" in
  serve)
    echo "Bundling browser code…"
    npx esbuild web/main.ts --bundle --format=esm --outfile=web/main.js --log-level=warning
    exec node src/server.ts
    ;;
  *)
    echo "usage: ./run.sh serve"; exit 1;;
esac
