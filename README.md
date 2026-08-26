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

## Production build (Hostinger)

Build SPA into Laravel `public`:

```bash
cd frontend
npm ci
npm run build
# copy dist → backend/public (index.html + assets)
```

On server (document root = `.../keaone/public`):

```bash
cd ~/domains/justusku.co.id/public_html/keaone
git pull origin main
composer install --no-dev --optimize-autoloader
cp .env.example .env   # first time only, then edit
php artisan key:generate   # first time only
php artisan migrate --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
chmod -R ug+rwx storage bootstrap/cache
```

Set in `.env`:

```env
APP_URL=https://keaone.justusku.co.id
FRONTEND_URL=https://keaone.justusku.co.id
APP_ENV=production
APP_DEBUG=false
```

Use MySQL credentials from Hostinger hPanel.
