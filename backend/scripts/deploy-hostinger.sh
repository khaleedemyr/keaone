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

echo ""
echo "==> Background workers (run on server)"
echo "Queue worker:  php artisan queue:work --sleep=3 --tries=3 --max-time=3600"
echo "Scheduler cron: * * * * * cd $(pwd) && php artisan schedule:run >> /dev/null 2>&1"
echo ""
echo "Redis (recommended production): SESSION_DRIVER=redis CACHE_STORE=redis QUEUE_CONNECTION=redis"
echo "Partitions (MySQL): php artisan migrate && php artisan partitions:ensure"
echo "Retention cron via: php artisan schedule:run (activity-logs, notifications, chat prune)"
echo ""
echo "==> Done"
