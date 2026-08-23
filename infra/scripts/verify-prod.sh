#!/usr/bin/env bash
set -euo pipefail

echo "======================================================="
echo " FaultForge AI — Production Readiness Verification"
echo "======================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Validating Dockerfile existence..."
for f in apps/api/Dockerfile apps/worker/Dockerfile apps/web/Dockerfile \
         labs/commerce-lab/Dockerfile labs/payment-lab/Dockerfile labs/perf-lab/Dockerfile; do
  if [ -f "$f" ]; then
    echo "  ✓ $f exists"
  else
    echo "  ✗ Missing $f"
    exit 1
  fi
done

echo "[2/4] Validating Nginx SPA configuration..."
if [ -f "apps/web/nginx.conf" ]; then
  echo "  ✓ apps/web/nginx.conf exists"
else
  echo "  ✗ Missing apps/web/nginx.conf"
  exit 1
fi

echo "[3/4] Validating docker-compose.prod.yml..."
if [ -f "infra/docker/docker-compose.prod.yml" ]; then
  echo "  ✓ infra/docker/docker-compose.prod.yml exists"
else
  echo "  ✗ Missing docker-compose.prod.yml"
  exit 1
fi

echo "[4/4] Verifying all workspace builds locally..."
npm run build

echo "======================================================="
echo " All Production Assets Verified Successfully! [OK]"
echo "======================================================="
