#!/usr/bin/env bash
# Run on Hostinger after git pull (from repo root: bash backend/scripts/deploy-hostinger.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/backend"

echo "==> Composer install"
composer install --no-dev --optimize-autoloader

echo "==> Migration status (before)"
php artisan migrate:status || true

echo "==> Migrate"
php artisan migrate --force

echo "==> Migration status (after)"
php artisan migrate:status

echo "==> Cache"
php artisan config:cache
php artisan route:cache

echo "==> Done"
