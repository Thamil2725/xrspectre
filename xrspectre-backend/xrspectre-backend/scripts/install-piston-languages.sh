#!/bin/bash
# Installs the language runtimes the platform needs onto a running
# Piston instance. Run this once after `docker compose up -d piston`.
#
# Usage: ./scripts/install-piston-languages.sh [piston-url]

set -e

PISTON_URL="${1:-http://localhost:2000}"

install() {
  local language="$1"
  echo "Installing $language..."
  curl -s -X POST "$PISTON_URL/api/v2/packages" \
    -H 'Content-Type: application/json' \
    -d "{\"language\": \"$language\", \"version\": \"*\"}" | cat
  echo ""
}

install "node"
install "python"
install "gcc"      # provides the c++ runtime
install "java"

echo "Done. Verify with: curl $PISTON_URL/api/v2/runtimes"
