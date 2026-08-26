# KEA One ERP

POS + inventory ERP. Laravel API + React SPA.

## Run locally

Backend:

```bash
cd backend
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Demo login

- Email: `owner@demo.test`
- Password: `password`
- Cashier: `kasir@demo.test` / `password`

## Production (Hostinger + Git)

Repo: https://github.com/khaleedemyr/keaone.git

Monorepo layout: `frontend/` (source) + `backend/` (Laravel). Production SPA is already in `backend/public/` (`index.html` + `assets/`).

### Local: rebuild SPA before push (when UI changes)

```bash
cd frontend
npm ci
npm run build
# copy dist → backend/public (index.html + assets + svgs)
git add backend/public
git commit -m "Update production SPA build"
git push origin main
```

### Hostinger: first deploy (SSH)

1. In hPanel → Domains → `keaone.justusku.co.id` set **document root** to:

   `/home/u933641250/domains/justusku.co.id/public_html/keaone/backend/public`

2. PHP version **8.3+** for that domain.

3. SSH:

```bash
cd ~/domains/justusku.co.id/public_html
# if folder empty / not a git repo yet:
rm -rf keaone   # only if empty placeholder — backup first if anything important
git clone https://github.com/khaleedemyr/keaone.git keaone

cd keaone/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
# edit .env: APP_URL, DB_*, FRONTEND_URL
php artisan key:generate
php artisan migrate --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
chmod -R ug+rwx storage bootstrap/cache
```

### Hostinger: later updates

```bash
cd ~/domains/justusku.co.id/public_html/keaone
git pull origin main
cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

### `.env` on server

```env
APP_URL=https://keaone.justusku.co.id
FRONTEND_URL=https://keaone.justusku.co.id
APP_ENV=production
APP_DEBUG=false
```

Use MySQL credentials from Hostinger hPanel.
