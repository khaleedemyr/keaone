<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Support\CurrentCompany;
use Illuminate\Http\Request;
use Throwable;

class ActivityLogger
{
    /**
     * @param  array<string, mixed>  $attrs
     */
    public static function record(array $attrs, ?Request $request = null): void
    {
        try {
            $request ??= request();
            $user = $request->user();
            $companyId = $attrs['company_id'] ?? CurrentCompany::id($user);

            ActivityLog::query()->create([
                'company_id' => $companyId,
                'user_id' => $attrs['user_id'] ?? $user?->id,
                'scope' => $attrs['scope'] ?? self::scope($user, $companyId),
                'action' => $attrs['action'] ?? 'unknown',
                'menu_key' => $attrs['menu_key'] ?? null,
                'summary' => mb_substr((string) ($attrs['summary'] ?? 'Aktivitas'), 0, 255),
                'target' => isset($attrs['target']) ? mb_substr((string) $attrs['target'], 0, 120) : null,
                'method' => $attrs['method'] ?? $request->method(),
                'path' => mb_substr((string) ($attrs['path'] ?? self::path($request)), 0, 180),
                'status' => $attrs['status'] ?? null,
                'ip' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
                'meta' => $attrs['meta'] ?? null,
                'created_at' => now(),
            ]);
        } catch (Throwable) {
            // Never break the main request because logging failed.
        }
    }

    public static function fromRequest(Request $request, int $status): void
    {
        $described = self::describe($request);
        $path = self::path($request);
        if ($path === 'company/settings' && $request->exists('modules') && ! $request->exists('settings')) {
            $described['menu_key'] = 'modules';
            $described['summary'] = 'Ubah modul';
        }
        if ($path === 'company/settings' && is_array($request->input('settings'))) {
            $keys = array_keys($request->input('settings'));
            if ($keys !== [] && array_diff($keys, ['pos_mode']) === []) {
                $described['menu_key'] = 'possettings';
                $described['summary'] = 'Ubah mode kasir';
            } elseif (in_array('receipt_layout', $keys, true)) {
                $described['menu_key'] = 'ops';
                $described['summary'] = 'Ubah desain struk';
            }
        }
        if ($path === 'sales/reports') {
            $kind = (string) $request->query('kind', 'summary');
            $described['menu_key'] = \App\Support\MenuCatalog::salesReportMenu($kind);
            $described['summary'] = 'Lihat laporan penjualan';
            $described['action'] = 'view';
        }

        $target = self::target($request);
        $summary = $described['summary'];
        if ($target && ! str_contains($summary, $target)) {
            $summary .= ': '.$target;
        }

        self::record([
            'action' => $described['action'],
            'menu_key' => $described['menu_key'],
            'summary' => $summary,
            'target' => $target,
            'status' => $status,
            'meta' => self::meta($request),
        ], $request);
    }

    public static function client(string $kind, string $target, Request $request): void
    {
        $map = [
            'open_app' => [
                'insight' => 'Membuka dasbor',
                'pos' => 'Membuka kasir',
                'master' => 'Membuka data master',
                'sales' => 'Membuka penjualan',
                'admin' => 'Membuka administrator',
                'settings' => 'Membuka pengaturan',
                'overview' => 'Membuka ringkasan platform',
                'tenants' => 'Membuka daftar tenant',
                'billing' => 'Membuka billing',
            ],
            'open_section' => [
                'users' => 'Membuka menu pengguna',
                'roles' => 'Membuka menu peran',
                'company' => 'Membuka profil perusahaan',
                'outlets' => 'Membuka menu outlet',
                'modules' => 'Membuka menu modul',
                'ops' => 'Membuka pajak & struk',
                'possettings' => 'Membuka pengaturan POS',
                'cafetables' => 'Membuka denah meja',
                'account' => 'Membuka profil & tampilan',
                'billing' => 'Membuka menu billing',
                'logs' => 'Membuka log aktivitas',
                'products' => 'Membuka menu produk',
                'categories' => 'Membuka menu kategori',
                'subcategories' => 'Membuka menu sub kategori',
                'units' => 'Membuka menu satuan',
                'itemtypes' => 'Membuka menu tipe item',
                'pricechannels' => 'Membuka menu kanal harga',
                'discounts' => 'Membuka menu diskon',
                'promotions' => 'Membuka menu promo',
                'choicetypes' => 'Membuka menu jenis pilihan',
                'choices' => 'Membuka menu pilihan',
                'warehouses' => 'Membuka menu gudang',
                'suppliers' => 'Membuka menu pemasok',
                'customers' => 'Membuka menu pelanggan',
                'plans' => 'Membuka paket langganan',
                'invoices' => 'Membuka faktur platform',
                'types' => 'Membuka jenis usaha',
            ],
            'open_calendar' => [
                'calendar' => 'Membuka kalender',
            ],
        ];

        $summary = $map[$kind][$target] ?? ('Aktivitas: '.$kind.' / '.$target);

        self::record([
            'action' => $kind,
            'menu_key' => self::menuFromClient($kind, $target),
            'summary' => $summary,
            'target' => $target,
            'status' => 200,
            'method' => 'UI',
            'path' => $kind,
        ], $request);
    }

    /**
     * @return array{menu_key: string, action: string, summary: string}
     */
    public static function describe(Request $request): array
    {
        $method = strtoupper($request->method());
        $path = self::path($request);

        foreach (self::rules() as $rule) {
            if ($rule[0] !== $method) {
                continue;
            }
            if (! self::match($rule[1], $path)) {
                continue;
            }

            return [
                'menu_key' => $rule[2],
                'action' => $rule[3],
                'summary' => $rule[4],
            ];
        }

        return [
            'menu_key' => self::guessMenu($path),
            'action' => match ($method) {
                'POST' => 'create',
                'PUT', 'PATCH' => 'edit',
                'DELETE' => 'delete',
                default => strtolower($method),
            },
            'summary' => $method.' '.$path,
        ];
    }

    private static function path(Request $request): string
    {
        return preg_replace('#^api/v1/#', '', trim($request->path(), '/')) ?? $request->path();
    }

    private static function match(string $pattern, string $path): bool
    {
        $regex = '#^'.str_replace('\*', '[^/]+', preg_quote($pattern, '#')).'$#';

        return (bool) preg_match($regex, $path);
    }

    private static function guessMenu(string $path): string
    {
        if (str_starts_with($path, 'platform/')) {
            $part = explode('/', $path)[1] ?? 'platform';

            return match ($part) {
                'companies' => 'tenants',
                'plans', 'invoices' => 'billing',
                'business-types' => 'catalog',
                'blog-posts' => 'blog',
                'users' => 'operators',
                default => $part,
            };
        }

        $part = explode('/', $path)[0] ?: 'settings';

        return match ($part) {
            'choice-types' => 'choicetypes',
            'item-types' => 'itemtypes',
            'price-channels' => 'pricechannels',
            'dining-tables' => 'cafetables',
            'dining-layouts' => 'cafetables',
            default => $part,
        };
    }

    private static function menuFromClient(string $kind, string $target): string
    {
        if ($kind === 'open_calendar') {
            return 'settings';
        }

        if (str_starts_with($target, 'sales:')) {
            $section = substr($target, 6);

            return match ($section) {
                'tickets' => 'sales',
                'products' => 'salesreportproducts',
                'cashiers' => 'salesreportcashiers',
                'methods' => 'salesreportmethods',
                'channels' => 'salesreportchannels',
                'daily' => 'salesreportdaily',
                default => 'salesreportsummary',
            };
        }

        return match ($target) {
            'master' => 'products',
            'admin' => 'users',
            'account' => 'settings',
            'types' => 'catalog',
            'plans', 'invoices' => 'billing',
            default => $target,
        };
    }

    private static function scope($user, ?int $companyId): string
    {
        if ($companyId) {
            return 'tenant';
        }

        return $user?->is_platform ? 'platform' : 'auth';
    }

    private static function target(Request $request): ?string
    {
        foreach (['name', 'email', 'title', 'sku', 'number', 'company_name'] as $key) {
            $value = $request->input($key);
            if (is_string($value) && $value !== '') {
                return mb_substr($value, 0, 120);
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function meta(Request $request): ?array
    {
        $payload = $request->except([
            'password',
            'password_confirmation',
            'current_password',
            'token',
            'file',
        ]);
        if ($payload === []) {
            return null;
        }

        $clean = self::sanitize($payload);
        $encoded = json_encode($clean);
        if (! is_string($encoded) || strlen($encoded) > 2000) {
            return ['keys' => array_keys($payload)];
        }

        return $clean;
    }

    private static function sanitize(mixed $value): mixed
    {
        $hidden = ['password', 'password_confirmation', 'current_password', 'token', 'new_password'];

        if (! is_array($value)) {
            if (is_string($value)) {
                return mb_substr($value, 0, 200);
            }

            return $value;
        }

        $out = [];
        foreach ($value as $key => $item) {
            if (in_array(strtolower((string) $key), $hidden, true)) {
                $out[$key] = '[hidden]';
                continue;
            }
            $out[$key] = self::sanitize($item);
        }

        return $out;
    }

    /**
     * @return list<array{0: string, 1: string, 2: string, 3: string, 4: string}>
     */
    private static function rules(): array
    {
        return [
            ['POST', 'auth/logout', 'auth', 'logout', 'Keluar dari konsol'],
            ['POST', 'auth/logout-all', 'auth', 'logout', 'Keluar dari semua perangkat'],
            ['PUT', 'me', 'settings', 'edit', 'Ubah profil'],
            ['PUT', 'me/password', 'settings', 'edit', 'Ubah password'],
            ['PUT', 'me/preferences', 'settings', 'edit', 'Ubah tampilan'],
            ['POST', 'me/wallpaper', 'settings', 'edit', 'Ganti latar desktop'],
            ['POST', 'me/avatar', 'settings', 'edit', 'Ganti foto profil'],
            ['POST', 'reminders', 'settings', 'create', 'Tambah pengingat'],
            ['DELETE', 'reminders/*', 'settings', 'delete', 'Hapus pengingat'],
            ['PUT', 'me/company', 'company', 'edit', 'Pindah perusahaan'],
            ['POST', 'me/companies', 'company', 'create', 'Buat perusahaan'],

            ['PUT', 'platform/companies/*', 'tenants', 'edit', 'Ubah tenant'],
            ['POST', 'platform/companies/*/invoices', 'billing', 'create', 'Terbitkan faktur tenant'],
            ['POST', 'platform/plans', 'billing', 'create', 'Tambah paket'],
            ['PUT', 'platform/plans/*', 'billing', 'edit', 'Ubah paket'],
            ['POST', 'platform/business-types', 'catalog', 'create', 'Tambah jenis usaha'],
            ['PUT', 'platform/business-types/*', 'catalog', 'edit', 'Ubah jenis usaha'],
            ['POST', 'platform/blog-posts', 'blog', 'create', 'Tambah artikel blog'],
            ['PUT', 'platform/blog-posts/*', 'blog', 'edit', 'Ubah artikel blog'],
            ['DELETE', 'platform/blog-posts/*', 'blog', 'delete', 'Hapus artikel blog'],
            ['POST', 'platform/blog-posts/*/cover', 'blog', 'edit', 'Unggah cover blog'],
            ['POST', 'platform/invoices/*/pay', 'billing', 'edit', 'Tandai faktur lunas'],
            ['POST', 'platform/invoices/*/void', 'billing', 'edit', 'Batalkan faktur'],
            ['POST', 'platform/roles', 'roles', 'create', 'Tambah peran platform'],
            ['PUT', 'platform/roles/*', 'roles', 'edit', 'Ubah peran platform'],
            ['DELETE', 'platform/roles/*', 'roles', 'edit', 'Nonaktifkan peran platform'],
            ['POST', 'platform/users', 'operators', 'create', 'Tambah operator'],
            ['PUT', 'platform/users/*', 'operators', 'edit', 'Ubah operator'],
            ['DELETE', 'platform/users/*', 'operators', 'edit', 'Nonaktifkan operator'],

            ['PUT', 'company', 'company', 'edit', 'Ubah profil perusahaan'],
            ['POST', 'company/logo', 'company', 'edit', 'Unggah logo toko'],
            ['DELETE', 'company/logo', 'company', 'edit', 'Hapus logo toko'],
            ['PUT', 'company/settings', 'ops', 'edit', 'Ubah pengaturan toko'],
            ['POST', 'billing/subscribe', 'billing', 'edit', 'Ubah langganan'],
            ['POST', 'roles', 'roles', 'create', 'Tambah peran'],
            ['PUT', 'roles/*', 'roles', 'edit', 'Ubah peran'],
            ['DELETE', 'roles/*', 'roles', 'edit', 'Nonaktifkan peran'],
            ['POST', 'users', 'users', 'create', 'Tambah pengguna'],
            ['PUT', 'users/*', 'users', 'edit', 'Ubah pengguna'],
            ['DELETE', 'users/*', 'users', 'edit', 'Nonaktifkan pengguna'],
            ['POST', 'outlets', 'outlets', 'create', 'Tambah outlet'],
            ['PUT', 'outlets/*', 'outlets', 'edit', 'Ubah outlet'],
            ['DELETE', 'outlets/*', 'outlets', 'edit', 'Nonaktifkan outlet'],
            ['POST', 'categories', 'categories', 'create', 'Tambah kategori'],
            ['PUT', 'categories/*', 'categories', 'edit', 'Ubah kategori'],
            ['DELETE', 'categories/*', 'categories', 'edit', 'Nonaktifkan kategori'],
            ['POST', 'subcategories', 'subcategories', 'create', 'Tambah sub kategori'],
            ['PUT', 'subcategories/*', 'subcategories', 'edit', 'Ubah sub kategori'],
            ['DELETE', 'subcategories/*', 'subcategories', 'edit', 'Nonaktifkan sub kategori'],
            ['POST', 'units', 'units', 'create', 'Tambah satuan'],
            ['PUT', 'units/*', 'units', 'edit', 'Ubah satuan'],
            ['DELETE', 'units/*', 'units', 'edit', 'Nonaktifkan satuan'],
            ['POST', 'item-types', 'itemtypes', 'create', 'Tambah tipe item'],
            ['PUT', 'item-types/*', 'itemtypes', 'edit', 'Ubah tipe item'],
            ['DELETE', 'item-types/*', 'itemtypes', 'edit', 'Nonaktifkan tipe item'],
            ['POST', 'price-channels', 'pricechannels', 'create', 'Tambah kanal harga'],
            ['PUT', 'price-channels/*', 'pricechannels', 'edit', 'Ubah kanal harga'],
            ['DELETE', 'price-channels/*', 'pricechannels', 'edit', 'Nonaktifkan kanal harga'],
            ['POST', 'discounts', 'discounts', 'create', 'Tambah diskon'],
            ['PUT', 'discounts/*', 'discounts', 'edit', 'Ubah diskon'],
            ['DELETE', 'discounts/*', 'discounts', 'edit', 'Nonaktifkan diskon'],
            ['POST', 'promotions', 'promotions', 'create', 'Tambah promo'],
            ['PUT', 'promotions/*', 'promotions', 'edit', 'Ubah promo'],
            ['DELETE', 'promotions/*', 'promotions', 'edit', 'Nonaktifkan promo'],
            ['POST', 'dining-tables', 'cafetables', 'create', 'Tambah meja kafe'],
            ['PUT', 'dining-tables/*', 'cafetables', 'edit', 'Ubah meja kafe'],
            ['DELETE', 'dining-tables/*', 'cafetables', 'edit', 'Nonaktifkan meja kafe'],
            ['POST', 'dining-layouts', 'cafetables', 'create', 'Tambah denah meja'],
            ['PUT', 'dining-layouts/*', 'cafetables', 'edit', 'Ubah denah meja'],
            ['DELETE', 'dining-layouts/*', 'cafetables', 'edit', 'Nonaktifkan denah meja'],
            ['POST', 'choice-types', 'choicetypes', 'create', 'Tambah jenis pilihan'],
            ['PUT', 'choice-types/*', 'choicetypes', 'edit', 'Ubah jenis pilihan'],
            ['DELETE', 'choice-types/*', 'choicetypes', 'edit', 'Nonaktifkan jenis pilihan'],
            ['POST', 'choices', 'choices', 'create', 'Tambah pilihan'],
            ['PUT', 'choices/*', 'choices', 'edit', 'Ubah pilihan'],
            ['DELETE', 'choices/*', 'choices', 'edit', 'Nonaktifkan pilihan'],
            ['POST', 'warehouses', 'warehouses', 'create', 'Tambah gudang'],
            ['PUT', 'warehouses/*', 'warehouses', 'edit', 'Ubah gudang'],
            ['DELETE', 'warehouses/*', 'warehouses', 'edit', 'Nonaktifkan gudang'],
            ['POST', 'customers', 'customers', 'create', 'Tambah pelanggan'],
            ['PUT', 'customers/*', 'customers', 'edit', 'Ubah pelanggan'],
            ['DELETE', 'customers/*', 'customers', 'edit', 'Nonaktifkan pelanggan'],
            ['POST', 'suppliers', 'suppliers', 'create', 'Tambah pemasok'],
            ['PUT', 'suppliers/*', 'suppliers', 'edit', 'Ubah pemasok'],
            ['DELETE', 'suppliers/*', 'suppliers', 'edit', 'Nonaktifkan pemasok'],
            ['POST', 'products', 'products', 'create', 'Tambah produk'],
            ['POST', 'products/*/images/*/primary', 'products', 'edit', 'Atur foto utama produk'],
            ['POST', 'products/*/images', 'products', 'edit', 'Unggah foto produk'],
            ['DELETE', 'products/*/images/*', 'products', 'edit', 'Hapus foto produk'],
            ['PUT', 'products/*', 'products', 'edit', 'Ubah produk'],
            ['DELETE', 'products/*', 'products', 'edit', 'Nonaktifkan produk'],
            ['POST', 'contacts', 'contacts', 'create', 'Tambah kontak'],
            ['PUT', 'contacts/*', 'contacts', 'edit', 'Ubah kontak'],
            ['POST', 'sales', 'pos', 'create', 'Buat penjualan'],
            ['POST', 'sales/*/payments', 'sales', 'edit', 'Tambah pembayaran'],
            ['POST', 'sales/*/cancel', 'sales', 'delete', 'Batalkan penjualan'],
        ];
    }
}
