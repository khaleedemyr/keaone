<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Support\CurrentCompany;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
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

    public static function fromRequest(Request $request, int $status, ?Response $response = null): void
    {
        $described = self::describe($request);
        $path = self::path($request);
        if ($path === 'company/settings' && $request->exists('modules') && ! $request->exists('settings')) {
            $described['menu_key'] = 'modules';
            $described['summary'] = 'Ubah modul';
        }
        if ($path === 'company/settings' && is_array($request->input('settings'))) {
            $keys = array_keys($request->input('settings'));
            $procurementKeys = config('procurement.settings_keys', []);
            if ($keys !== [] && array_diff($keys, $procurementKeys) === []) {
                $described['menu_key'] = 'purchasesettings';
                $described['summary'] = 'Ubah pengaturan procurement';
            } elseif ($keys !== [] && array_diff($keys, config('inventory.settings_keys', [])) === []) {
                $described['menu_key'] = 'stocksettings';
                $described['summary'] = 'Ubah pengaturan persediaan';
            } elseif ($keys !== [] && array_diff($keys, ['pos_mode']) === []) {
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

        $target = self::target($request) ?? self::routeTarget($request) ?? self::responseTarget($response);
        $changes = self::diffFromSnapshots($request);
        $summary = $described['summary'];
        if ($target && ! str_contains($summary, (string) $target)) {
            $summary .= ': '.$target;
        }
        $changeSuffix = self::changeSummarySuffix($changes, $request);
        if ($changeSuffix !== '') {
            $summary .= $changeSuffix;
        }
        $summary = mb_substr($summary, 0, 255);

        $meta = self::meta($request, $changes);

        self::record([
            'action' => $described['action'],
            'menu_key' => $described['menu_key'],
            'summary' => $summary,
            'target' => $target,
            'status' => $status,
            'meta' => $meta,
        ], $request);
    }

    public static function client(string $kind, string $target, Request $request, ?string $ref = null): void
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
                'products' => 'Membuka menu item',
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
                'purchase:pr' => 'Membuka permintaan pembelian',
                'purchase:po' => 'Membuka pesanan pembelian',
                'purchase:gr' => 'Membuka penerimaan barang',
                'procurement:dashboard' => 'Membuka dasbor procurement',
                'procurement:pr' => 'Membuka permintaan pembelian',
                'procurement:po' => 'Membuka pesanan pembelian',
                'procurement:gr' => 'Membuka penerimaan barang',
                'procurement:direct' => 'Membuka pembelian langsung',
                'procurement:return' => 'Membuka retur pembelian',
                'procurement:adjustments' => 'Membuka nota debit/kredit',
                'procurement:delivery' => 'Membuka jadwal pengiriman',
                'procurement:invoices' => 'Membuka tagihan supplier',
                'procurement:match' => 'Membuka three-way match',
                'procurement:payments' => 'Membuka batch pembayaran supplier',
                'procurement:prepayments' => 'Membuka uang muka supplier',
                'procurement:settings' => 'Membuka pengaturan procurement',
                'plans' => 'Membuka paket langganan',
                'invoices' => 'Membuka faktur platform',
                'types' => 'Membuka jenis usaha',
            ],
            'open_calendar' => [
                'calendar' => 'Membuka kalender',
            ],
            'view_doc' => [
                'pr' => 'Lihat PR',
                'po' => 'Lihat PO',
                'gr' => 'Lihat penerimaan barang',
                'purchasereturn' => 'Lihat retur pembelian',
                'vendoradjustment' => 'Lihat nota debit/kredit',
                'vendorinvoice' => 'Lihat tagihan supplier',
                'vendorpaymentbatch' => 'Lihat batch pembayaran supplier',
                'vendorprepayment' => 'Lihat uang muka supplier',
                'vendorwithholding' => 'Lihat potong PPh supplier',
                'procurementbudgets' => 'Lihat anggaran procurement',
                'fixedassets' => 'Lihat aset tetap',
                'rfqs' => 'Lihat RFQ',
                'supplierpricelists' => 'Lihat daftar harga supplier',
                'product' => 'Lihat item',
                'sale' => 'Lihat penjualan',
                'contact' => 'Lihat kontak',
                'user' => 'Lihat pengguna',
                'role' => 'Lihat peran',
                'outlet' => 'Lihat outlet',
                'floorlayout' => 'Lihat denah meja',
            ],
            'open_form' => [
                'pr:create' => 'Buka form buat PR',
                'pr:edit' => 'Buka form ubah PR',
                'po:create' => 'Buka form buat PO',
                'po:edit' => 'Buka form ubah PO',
                'gr:create' => 'Buka form buat penerimaan barang',
                'gr:edit' => 'Buka form ubah penerimaan barang',
                'purchasereturn:create' => 'Buka form buat retur pembelian',
                'purchasereturn:edit' => 'Buka form ubah retur pembelian',
                'vendoradjustment:create' => 'Buka form buat nota debit/kredit',
                'vendoradjustment:edit' => 'Buka form ubah nota debit/kredit',
                'vendorinvoice:create' => 'Buka form buat tagihan supplier',
                'vendorinvoice:edit' => 'Buka form ubah tagihan supplier',
                'vendorpaymentbatch:create' => 'Buka form buat batch pembayaran supplier',
                'vendorpaymentbatch:edit' => 'Buka form ubah batch pembayaran supplier',
                'vendorprepayment:create' => 'Buka form buat uang muka supplier',
                'vendorprepayment:edit' => 'Buka form ubah uang muka supplier',
                'rfq:create' => 'Buka form buat RFQ',
                'rfq:edit' => 'Buka form ubah RFQ',
                'supplierpricelist:create' => 'Buka form buat harga supplier',
                'supplierpricelist:edit' => 'Buka form ubah harga supplier',
                'product:create' => 'Buka form buat item',
                'product:edit' => 'Buka form ubah item',
                'category:create' => 'Buka form buat kategori',
                'category:edit' => 'Buka form ubah kategori',
                'subcategory:create' => 'Buka form buat sub kategori',
                'subcategory:edit' => 'Buka form ubah sub kategori',
                'unit:create' => 'Buka form buat satuan',
                'unit:edit' => 'Buka form ubah satuan',
                'itemtype:create' => 'Buka form buat tipe item',
                'itemtype:edit' => 'Buka form ubah tipe item',
                'pricechannel:create' => 'Buka form buat kanal harga',
                'pricechannel:edit' => 'Buka form ubah kanal harga',
                'discount:create' => 'Buka form buat diskon',
                'discount:edit' => 'Buka form ubah diskon',
                'promotion:create' => 'Buka form buat promo',
                'promotion:edit' => 'Buka form ubah promo',
                'customfield:create' => 'Buka form buat field kustom',
                'customfield:edit' => 'Buka form ubah field kustom',
                'choicetype:create' => 'Buka form buat jenis pilihan',
                'choicetype:edit' => 'Buka form ubah jenis pilihan',
                'choice:create' => 'Buka form buat pilihan',
                'choice:edit' => 'Buka form ubah pilihan',
                'warehouse:create' => 'Buka form buat gudang',
                'warehouse:edit' => 'Buka form ubah gudang',
                'customer:create' => 'Buka form buat pelanggan',
                'customer:edit' => 'Buka form ubah pelanggan',
                'supplier:create' => 'Buka form buat pemasok',
                'supplier:edit' => 'Buka form ubah pemasok',
                'user:create' => 'Buka form buat pengguna',
                'user:edit' => 'Buka form ubah pengguna',
                'role:create' => 'Buka form buat peran',
                'role:edit' => 'Buka form ubah peran',
                'outlet:create' => 'Buka form buat outlet',
                'outlet:edit' => 'Buka form ubah outlet',
            ],
        ];

        $summary = $map[$kind][$target] ?? ('Aktivitas: '.$kind.' / '.$target);
        if ($ref && ! str_contains($summary, $ref)) {
            $summary .= ': '.$ref;
        }

        self::record([
            'action' => $kind,
            'menu_key' => self::menuFromClient($kind, $target),
            'summary' => mb_substr($summary, 0, 255),
            'target' => $ref ? mb_substr($ref, 0, 120) : $target,
            'status' => 200,
            'method' => 'UI',
            'path' => $kind,
        ], $request);
    }

    public static function isShowPath(string $path): bool
    {
        if (preg_match('#/(receipt|images|messages|read|pay|void|cover|media|share|submit|approve|reject|cancel|confirm|order|payments|primary|barcode)/#', $path)) {
            return false;
        }

        if (in_array($path, ['sales/settlement', 'sales/reports', 'suppliers/top'], true)) {
            return false;
        }

        return (bool) preg_match(
            '#^(purchase-requisitions|purchase-orders|goods-receipts|purchase-returns|vendor-adjustment-notes|vendor-invoices|vendor-payment-batches|vendor-prepayments|products|sales|contacts|users|roles|outlets|dining-layouts|platform/(blog-posts|companies))/\d+$#',
            $path,
        );
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

        if ($part === 'procurement') {
            return self::procurementMenuKey($path);
        }

        return match ($part) {
            'choice-types' => 'choicetypes',
            'item-types' => 'itemtypes',
            'price-channels' => 'pricechannels',
            'dining-tables' => 'cafetables',
            'dining-layouts' => 'cafetables',
            'purchase-requisitions' => 'purchaserequisitions',
            'purchase-orders' => 'purchaseorders',
            'goods-receipts' => 'goodsreceipts',
            'purchase-returns' => 'purchasereturns',
            'vendor-adjustment-notes' => 'vendoradjustmentnotes',
            'vendor-invoices' => 'vendorinvoices',
            'vendor-payment-batches' => 'vendorpaymentbatches',
            'vendor-prepayments' => 'vendorprepayments',
            'vendor-withholding' => 'vendorwithholding',
            'gl-accounts' => 'glaccounts',
            'gl-journals' => 'gljournals',
            'budgets' => 'procurementbudgets',
            'procurement-contracts' => 'procurementcontracts',
            'approval-matrix' => 'approvalmatrix',
            'approval-delegations' => 'approvaldelegations',
            'procurement-plans' => 'procurementplans',
            'assets' => 'fixedassets',
            'rfqs' => 'rfqs',
            'supplier-product-prices' => 'supplierpricelists',
            'match-exceptions' => 'matchexceptions',
            default => $part,
        };
    }

    private static function procurementMenuKey(string $path): string
    {
        $sub = explode('/', $path)[1] ?? '';

        return match ($sub) {
            'dashboard' => 'procurementdashboard',
            'delivery-schedules' => 'deliveryschedules',
            'attachments' => 'procurementdashboard',
            default => 'procurementdashboard',
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

        if (str_starts_with($target, 'purchase:') || str_starts_with($target, 'procurement:')) {
            $prefixLen = str_starts_with($target, 'procurement:') ? 12 : 9;
            $section = substr($target, $prefixLen);

            return match ($section) {
                'dashboard' => 'procurementdashboard',
                'pr' => 'purchaserequisitions',
                'po' => 'purchaseorders',
                'gr', 'direct' => 'goodsreceipts',
                'return' => 'purchasereturns',
                'adjustments' => 'vendoradjustmentnotes',
                'delivery' => 'deliveryschedules',
                'invoices' => 'vendorinvoices',
                'match' => 'matchexceptions',
                'payments' => 'vendorpaymentbatches',
                'prepayments' => 'vendorprepayments',
                'withholding' => 'vendorwithholding',
                'journals' => 'gljournals',
                'budgets' => 'procurementbudgets',
                'contracts' => 'procurementcontracts',
                'plans' => 'procurementplans',
                'assets' => 'fixedassets',
                'rfqs' => 'rfqs',
                'vendorpricelists' => 'supplierpricelists',
                'settings' => 'purchasesettings',
                default => 'procurementdashboard',
            };
        }

        if ($kind === 'view_doc' || $kind === 'open_form') {
            $base = explode(':', $target)[0] ?? $target;

            return match ($base) {
                'pr' => 'purchaserequisitions',
                'po' => 'purchaseorders',
                'gr' => 'goodsreceipts',
                'purchasereturn' => 'purchasereturns',
                'vendoradjustment' => 'vendoradjustmentnotes',
                'vendorinvoice' => 'vendorinvoices',
                'vendorpaymentbatch' => 'vendorpaymentbatches',
                'vendorprepayment' => 'vendorprepayments',
                'product' => 'products',
                'category' => 'categories',
                'subcategory' => 'subcategories',
                'unit' => 'units',
                'itemtype' => 'itemtypes',
                'pricechannel' => 'pricechannels',
                'discount' => 'discounts',
                'promotion' => 'promotions',
                'customfield' => 'customfields',
                'choicetype' => 'choicetypes',
                'choice' => 'choices',
                'warehouse' => 'warehouses',
                'customer' => 'customers',
                'supplier' => 'suppliers',
                'user' => 'users',
                'role' => 'roles',
                'outlet' => 'outlets',
                'sale' => 'sales',
                'contact' => 'contacts',
                'floorlayout' => 'cafetables',
                default => self::guessMenu($base),
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

    private static function routeTarget(Request $request): ?string
    {
        foreach ($request->route()?->parameters() ?? [] as $model) {
            $label = self::modelLabel($model);
            if ($label) {
                return $label;
            }
        }

        return null;
    }

    private static function modelLabel(mixed $model): ?string
    {
        if (! is_object($model)) {
            return null;
        }

        if (isset($model->number) && is_string($model->number) && $model->number !== '') {
            return $model->number;
        }

        if (isset($model->name) && is_string($model->name) && $model->name !== '') {
            $label = $model->name;
            if (isset($model->sku) && is_string($model->sku) && $model->sku !== '') {
                $label .= ' ('.$model->sku.')';
            }

            return $label;
        }

        if (isset($model->title) && is_string($model->title) && $model->title !== '') {
            return $model->title;
        }

        if (isset($model->label) && is_string($model->label) && $model->label !== '') {
            return $model->label;
        }

        if (isset($model->email) && is_string($model->email) && $model->email !== '') {
            return $model->email;
        }

        if (isset($model->code) && is_string($model->code) && $model->code !== '') {
            return $model->code;
        }

        return null;
    }

    private static function responseTarget(?Response $response): ?string
    {
        if (! $response) {
            return null;
        }

        $content = $response->getContent();
        if (! is_string($content) || $content === '') {
            return null;
        }

        try {
            $json = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
            $data = $json['data'] ?? null;
            if (! is_array($data)) {
                return null;
            }

            if (isset($data['number']) && is_string($data['number']) && $data['number'] !== '') {
                return $data['number'];
            }

            if (isset($data['name']) && is_string($data['name']) && $data['name'] !== '') {
                $label = $data['name'];
                if (isset($data['sku']) && is_string($data['sku']) && $data['sku'] !== '') {
                    $label .= ' ('.$data['sku'].')';
                }

                return $label;
            }

            if (isset($data['title']) && is_string($data['title']) && $data['title'] !== '') {
                return $data['title'];
            }

            if (isset($data['label']) && is_string($data['label']) && $data['label'] !== '') {
                return $data['label'];
            }

            if (isset($data['email']) && is_string($data['email']) && $data['email'] !== '') {
                return $data['email'];
            }

            return null;
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @return list<array{field: string, label: string, from: mixed, to: mixed}>
     */
    private static function diffFromSnapshots(Request $request): array
    {
        $snapshots = $request->attributes->get('activity_snapshots');
        if (! is_array($snapshots)) {
            return [];
        }

        $changes = [];
        foreach ($snapshots as $key => $before) {
            if (! is_array($before)) {
                continue;
            }
            $model = $request->route($key);
            if (! is_object($model) || ! method_exists($model, 'getAttributes')) {
                continue;
            }
            $after = $model->getAttributes();
            foreach ($after as $field => $newValue) {
                if (in_array($field, ['updated_at', 'created_at'], true)) {
                    continue;
                }
                $oldValue = $before[$field] ?? null;
                if (self::valuesEqual($oldValue, $newValue)) {
                    continue;
                }
                $changes[] = [
                    'field' => (string) $field,
                    'label' => self::fieldLabel((string) $field),
                    'from' => self::formatValue((string) $field, $oldValue),
                    'to' => self::formatValue((string) $field, $newValue),
                ];
            }
        }

        return $changes;
    }

    /**
     * @param  list<array{field: string, label: string, from: mixed, to: mixed}>  $changes
     */
    private static function changeSummarySuffix(array $changes, Request $request): string
    {
        $labels = array_column($changes, 'label');
        if ($request->has('items') && is_array($request->input('items'))) {
            $labels[] = count($request->input('items')).' item';
        }

        $labels = array_values(array_unique(array_filter($labels)));
        if ($labels === []) {
            return '';
        }

        $shown = array_slice($labels, 0, 4);
        $suffix = ' ('.implode(', ', $shown);
        if (count($labels) > count($shown)) {
            $suffix .= ', …';
        }

        return $suffix.')';
    }

    private static function valuesEqual(mixed $left, mixed $right): bool
    {
        if (is_array($left) || is_array($right)) {
            return json_encode($left) === json_encode($right);
        }

        return $left == $right;
    }

    private static function fieldLabel(string $field): string
    {
        return match ($field) {
            'name' => 'Nama',
            'sku' => 'SKU',
            'barcode' => 'Barcode',
            'description' => 'Deskripsi',
            'sell_price' => 'Harga jual',
            'cost_price' => 'Harga modal',
            'note' => 'Catatan',
            'status' => 'Status',
            'warehouse_id' => 'Gudang',
            'outlet_id' => 'Outlet',
            'supplier_id' => 'Pemasok',
            'needed_at' => 'Tanggal dibutuhkan',
            'expected_at' => 'Tanggal estimasi',
            'ordered_at' => 'Tanggal pesan',
            'is_active' => 'Status aktif',
            'track_stock' => 'Lacak stok',
            'is_procurement_item' => 'Item procurement',
            'is_fixed_asset_item' => 'Aset tetap',
            'min_stock' => 'Stok minimum',
            'category_id' => 'Kategori',
            'sub_category_id' => 'Sub kategori',
            'unit_id' => 'Satuan',
            'item_type_id' => 'Tipe item',
            'payment_term' => 'Term pembayaran',
            'payment_days' => 'Hari TOP',
            'tax_percent' => 'Pajak %',
            'phone' => 'Telepon',
            'email' => 'Email',
            'address' => 'Alamat',
            'city' => 'Kota',
            'province' => 'Provinsi',
            'value' => 'Nilai',
            'value_type' => 'Tipe nilai',
            'scope' => 'Cakupan',
            'code' => 'Kode',
            'type' => 'Tipe',
            'label' => 'Label',
            'key' => 'Kunci',
            'entity' => 'Entitas',
            'show_pos' => 'Tampil di POS',
            'is_raw_material' => 'Bahan baku',
            'vendor_ref' => 'Ref supplier',
            'invoice_date' => 'Tanggal tagihan',
            'due_date' => 'Jatuh tempo',
            'match_status' => 'Status match',
            'payment_status' => 'Status pembayaran',
            'payment_method' => 'Metode pembayaran',
            'reason' => 'Alasan',
            'amount_applied' => 'Jumlah dialokasikan',
            'procurement_match_mode' => 'Mode match procurement',
            'is_taxable' => 'Kena pajak',
            'is_default' => 'Default',
            'username' => 'Username',
            'slug' => 'Slug',
            'priority' => 'Prioritas',
            'starts_at' => 'Mulai',
            'ends_at' => 'Berakhir',
            'apply_mode' => 'Mode apply',
            'sort_order' => 'Urutan',
            default => ucfirst(str_replace('_', ' ', $field)),
        };
    }

    private static function formatValue(string $field, mixed $value): mixed
    {
        if ($value === null || $value === '') {
            return '—';
        }

        if ($field === 'is_active' || $field === 'track_stock' || $field === 'is_procurement_item' || $field === 'is_fixed_asset_item') {
            return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'Ya' : 'Tidak';
        }

        if (in_array($field, ['sell_price', 'cost_price', 'subtotal', 'tax', 'total'], true) && is_numeric($value)) {
            return (int) $value;
        }

        if (is_string($value)) {
            return mb_substr($value, 0, 120);
        }

        if (is_array($value)) {
            return '[data]';
        }

        return $value;
    }

    /**
     * @param  list<array{field: string, label: string, from: mixed, to: mixed}>  $changes
     * @return array<string, mixed>|null
     */
    private static function meta(Request $request, array $changes = []): ?array
    {
        $payload = $request->except([
            'password',
            'password_confirmation',
            'current_password',
            'token',
            'file',
            'images',
        ]);

        $meta = [];
        if ($changes !== []) {
            $meta['changes'] = array_slice($changes, 0, 20);
        }

        if ($payload === []) {
            return $meta !== [] ? $meta : null;
        }

        $clean = self::sanitize($payload);
        $encoded = json_encode($clean);
        if (! is_string($encoded) || strlen($encoded) > 2000) {
            $meta['keys'] = array_keys($payload);

            return $meta !== [] ? $meta : null;
        }

        return array_merge($clean, $meta);
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
            ['POST', 'custom-fields', 'customfields', 'create', 'Tambah field kustom'],
            ['PUT', 'custom-fields/*', 'customfields', 'edit', 'Ubah field kustom'],
            ['DELETE', 'custom-fields/*', 'customfields', 'delete', 'Nonaktifkan field kustom'],
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
            ['GET', 'suppliers/compliance-alerts', 'suppliers', 'view', 'Lihat alert compliance pemasok'],
            ['GET', 'suppliers/*', 'suppliers', 'view', 'Lihat detail pemasok'],
            ['POST', 'suppliers/*/suspend', 'suppliers', 'edit', 'Suspend pemasok'],
            ['POST', 'suppliers/*/blacklist', 'suppliers', 'edit', 'Blacklist pemasok'],
            ['POST', 'suppliers/*/reactivate', 'suppliers', 'edit', 'Aktifkan kembali pemasok'],
            ['POST', 'suppliers/*/approve-onboarding', 'suppliers', 'edit', 'Setujui onboarding pemasok'],
            ['POST', 'suppliers/*/portal-token', 'suppliers', 'edit', 'Buat token portal pemasok'],
            ['POST', 'suppliers/*/documents/*', 'suppliers', 'edit', 'Unggah dokumen pemasok'],
            ['DELETE', 'suppliers/*/documents/*', 'suppliers', 'edit', 'Hapus dokumen pemasok'],
            ['POST', 'public/vendor-portal/*/purchase-orders/*/confirm', 'suppliers', 'view', 'Konfirmasi PO via portal vendor'],
            ['POST', 'public/vendor-portal/*/purchase-orders/*/invoices', 'suppliers', 'view', 'Upload invoice via portal vendor'],
            ['POST', 'products', 'products', 'create', 'Tambah item'],
            ['POST', 'products/*/images/*/primary', 'products', 'edit', 'Atur foto utama item'],
            ['POST', 'products/*/images', 'products', 'edit', 'Unggah foto item'],
            ['DELETE', 'products/*/images/*', 'products', 'edit', 'Hapus foto item'],
            ['PUT', 'products/*', 'products', 'edit', 'Ubah item'],
            ['DELETE', 'products/*', 'products', 'edit', 'Nonaktifkan item'],
            ['POST', 'contacts', 'contacts', 'create', 'Tambah kontak'],
            ['PUT', 'contacts/*', 'contacts', 'edit', 'Ubah kontak'],
            ['POST', 'sales', 'pos', 'create', 'Buat penjualan'],
            ['POST', 'sales/*/payments', 'sales', 'edit', 'Tambah pembayaran penjualan'],
            ['POST', 'sales/*/cancel', 'sales', 'delete', 'Batalkan penjualan'],

            ['GET', 'sales/*', 'sales', 'view', 'Lihat penjualan'],
            ['GET', 'contacts/*', 'contacts', 'view', 'Lihat kontak'],
            ['GET', 'users/*', 'users', 'view', 'Lihat pengguna'],
            ['GET', 'roles/*', 'roles', 'view', 'Lihat peran'],
            ['GET', 'outlets/*', 'outlets', 'view', 'Lihat outlet'],
            ['GET', 'dining-layouts/*', 'cafetables', 'view', 'Lihat denah meja'],
            ['GET', 'platform/blog-posts/*', 'blog', 'view', 'Lihat artikel blog'],
            ['GET', 'purchase-requisitions/*', 'purchaserequisitions', 'view', 'Lihat PR'],
            ['GET', 'purchase-orders/*', 'purchaseorders', 'view', 'Lihat PO'],
            ['GET', 'goods-receipts/*', 'goodsreceipts', 'view', 'Lihat penerimaan barang'],
            ['GET', 'products/*', 'products', 'view', 'Lihat item'],

            ['POST', 'purchase-requisitions', 'purchaserequisitions', 'create', 'Buat PR'],
            ['PUT', 'purchase-requisitions/*', 'purchaserequisitions', 'edit', 'Ubah PR'],
            ['POST', 'purchase-requisitions/*/submit', 'purchaserequisitions', 'edit', 'Ajukan PR'],
            ['POST', 'purchase-requisitions/*/approve', 'purchaserequisitions', 'edit', 'Setujui PR'],
            ['POST', 'purchase-requisitions/*/reject', 'purchaserequisitions', 'edit', 'Tolak PR'],
            ['POST', 'purchase-requisitions/*/cancel', 'purchaserequisitions', 'delete', 'Batalkan PR'],
            ['POST', 'purchase-requisitions/*/share', 'purchaserequisitions', 'edit', 'Bagikan PR'],

            ['POST', 'purchase-orders', 'purchaseorders', 'create', 'Buat PO'],
            ['PUT', 'purchase-orders/*', 'purchaseorders', 'edit', 'Ubah PO'],
            ['POST', 'purchase-orders/*/submit', 'purchaseorders', 'edit', 'Ajukan PO'],
            ['POST', 'purchase-orders/*/approve', 'purchaseorders', 'edit', 'Setujui PO'],
            ['POST', 'purchase-orders/*/reject', 'purchaseorders', 'edit', 'Tolak PO'],
            ['POST', 'purchase-orders/*/order', 'purchaseorders', 'edit', 'Tandai PO dipesan'],
            ['POST', 'purchase-orders/*/cancel', 'purchaseorders', 'delete', 'Batalkan PO'],
            ['POST', 'purchase-orders/*/share', 'purchaseorders', 'edit', 'Bagikan PO'],

            ['POST', 'goods-receipts', 'goodsreceipts', 'create', 'Buat penerimaan barang'],
            ['PUT', 'goods-receipts/*', 'goodsreceipts', 'edit', 'Ubah penerimaan barang'],
            ['POST', 'goods-receipts/*/confirm', 'goodsreceipts', 'edit', 'Konfirmasi penerimaan barang'],
            ['POST', 'goods-receipts/*/void', 'goodsreceipts', 'edit', 'Batalkan (void) penerimaan barang'],
            ['POST', 'goods-receipts/*/cancel', 'goodsreceipts', 'delete', 'Batalkan penerimaan barang'],

            ['POST', 'purchase-orders/*/close', 'purchaseorders', 'edit', 'Tutup PO'],

            ['GET', 'procurement/dashboard', 'procurementdashboard', 'view', 'Lihat dasbor procurement'],
            ['GET', 'procurement/reports', 'procurementreports', 'view', 'Lihat laporan procurement'],
            ['GET', 'procurement/delivery-schedules', 'deliveryschedules', 'view', 'Lihat jadwal pengiriman'],
            ['GET', 'purchase-returns/*', 'purchasereturns', 'view', 'Lihat retur pembelian'],
            ['GET', 'vendor-adjustment-notes/*', 'vendoradjustmentnotes', 'view', 'Lihat nota debit/kredit'],
            ['GET', 'vendor-invoices/*', 'vendorinvoices', 'view', 'Lihat tagihan supplier'],
            ['GET', 'vendor-payment-batches/*', 'vendorpaymentbatches', 'view', 'Lihat batch pembayaran supplier'],
            ['GET', 'vendor-prepayments/*', 'vendorprepayments', 'view', 'Lihat uang muka supplier'],

            ['POST', 'purchase-returns', 'purchasereturns', 'create', 'Buat retur pembelian'],
            ['PUT', 'purchase-returns/*', 'purchasereturns', 'edit', 'Ubah retur pembelian'],
            ['POST', 'purchase-returns/*/submit', 'purchasereturns', 'edit', 'Ajukan retur pembelian'],
            ['POST', 'purchase-returns/*/approve', 'purchasereturns', 'edit', 'Setujui retur pembelian'],
            ['POST', 'purchase-returns/*/reject', 'purchasereturns', 'edit', 'Tolak retur pembelian'],
            ['POST', 'purchase-returns/*/confirm', 'purchasereturns', 'edit', 'Konfirmasi retur pembelian'],
            ['POST', 'purchase-returns/*/cancel', 'purchasereturns', 'delete', 'Batalkan retur pembelian'],

            ['POST', 'vendor-adjustment-notes', 'vendoradjustmentnotes', 'create', 'Buat nota debit/kredit'],
            ['PUT', 'vendor-adjustment-notes/*', 'vendoradjustmentnotes', 'edit', 'Ubah nota debit/kredit'],
            ['POST', 'vendor-adjustment-notes/*/confirm', 'vendoradjustmentnotes', 'edit', 'Konfirmasi nota debit/kredit'],
            ['POST', 'vendor-adjustment-notes/*/cancel', 'vendoradjustmentnotes', 'delete', 'Batalkan nota debit/kredit'],

            ['POST', 'purchase-orders/*/delivery-schedules', 'deliveryschedules', 'create', 'Tambah jadwal pengiriman'],
            ['PUT', 'purchase-orders/*/delivery-schedules/*', 'deliveryschedules', 'edit', 'Ubah jadwal pengiriman'],
            ['POST', 'purchase-orders/*/delivery-schedules/*/fulfill', 'deliveryschedules', 'edit', 'Tandai jadwal pengiriman selesai'],
            ['POST', 'purchase-orders/*/delivery-schedules/*/cancel', 'deliveryschedules', 'edit', 'Batalkan jadwal pengiriman'],
            ['DELETE', 'purchase-orders/*/delivery-schedules/*', 'deliveryschedules', 'delete', 'Hapus jadwal pengiriman'],

            ['POST', 'vendor-invoices', 'vendorinvoices', 'create', 'Buat tagihan supplier'],
            ['PUT', 'vendor-invoices/*', 'vendorinvoices', 'edit', 'Ubah tagihan supplier'],
            ['POST', 'vendor-invoices/*/submit', 'vendorinvoices', 'edit', 'Ajukan tagihan supplier'],
            ['POST', 'vendor-invoices/*/approve', 'vendorinvoices', 'edit', 'Setujui tagihan supplier'],
            ['POST', 'vendor-invoices/*/reject', 'vendorinvoices', 'edit', 'Tolak tagihan supplier'],
            ['POST', 'vendor-invoices/*/confirm', 'vendorinvoices', 'edit', 'Konfirmasi tagihan supplier'],
            ['POST', 'vendor-invoices/*/cancel', 'vendorinvoices', 'delete', 'Batalkan tagihan supplier'],
            ['POST', 'vendor-invoices/*/match', 'vendorinvoices', 'edit', 'Jalankan three-way match'],

            ['POST', 'match-exceptions/*/waive', 'matchexceptions', 'edit', 'Waive exception match'],

            ['POST', 'vendor-payment-batches', 'vendorpaymentbatches', 'create', 'Buat batch pembayaran supplier'],
            ['PUT', 'vendor-payment-batches/*', 'vendorpaymentbatches', 'edit', 'Ubah batch pembayaran supplier'],
            ['POST', 'vendor-payment-batches/*/submit', 'vendorpaymentbatches', 'edit', 'Ajukan batch pembayaran supplier'],
            ['POST', 'vendor-payment-batches/*/approve', 'vendorpaymentbatches', 'edit', 'Setujui batch pembayaran supplier'],
            ['POST', 'vendor-payment-batches/*/reject', 'vendorpaymentbatches', 'edit', 'Tolak batch pembayaran supplier'],
            ['POST', 'vendor-payment-batches/*/pay', 'vendorpaymentbatches', 'edit', 'Bayar batch supplier'],
            ['POST', 'vendor-payment-batches/*/cancel', 'vendorpaymentbatches', 'delete', 'Batalkan batch pembayaran supplier'],

            ['POST', 'vendor-prepayments', 'vendorprepayments', 'create', 'Buat uang muka supplier'],
            ['PUT', 'vendor-prepayments/*', 'vendorprepayments', 'edit', 'Ubah uang muka supplier'],
            ['POST', 'vendor-prepayments/*/submit', 'vendorprepayments', 'edit', 'Ajukan uang muka supplier'],
            ['POST', 'vendor-prepayments/*/approve', 'vendorprepayments', 'edit', 'Setujui uang muka supplier'],
            ['POST', 'vendor-prepayments/*/reject', 'vendorprepayments', 'edit', 'Tolak uang muka supplier'],
            ['POST', 'vendor-prepayments/*/pay', 'vendorprepayments', 'edit', 'Bayar uang muka supplier'],
            ['POST', 'vendor-prepayments/*/apply', 'vendorprepayments', 'edit', 'Alokasikan uang muka ke invoice'],
            ['POST', 'vendor-prepayments/*/cancel', 'vendorprepayments', 'delete', 'Batalkan uang muka supplier'],

            ['GET', 'vendor-withholding', 'vendorwithholding', 'view', 'Lihat potong PPh supplier'],
            ['POST', 'vendor-withholding/*/remit', 'vendorwithholding', 'edit', 'Tandai PPh disetor'],

            ['GET', 'gl-accounts', 'glaccounts', 'view', 'Lihat akun GL'],
            ['POST', 'gl-accounts', 'glaccounts', 'create', 'Buat akun GL'],
            ['PUT', 'gl-accounts/*', 'glaccounts', 'edit', 'Ubah akun GL'],
            ['DELETE', 'gl-accounts/*', 'glaccounts', 'delete', 'Nonaktifkan akun GL'],
            ['GET', 'gl-journals', 'gljournals', 'view', 'Lihat jurnal GL'],
            ['GET', 'gl-journals/*', 'gljournals', 'view', 'Detail jurnal GL'],

            ['GET', 'budgets', 'procurementbudgets', 'view', 'Lihat anggaran procurement'],
            ['POST', 'budgets', 'procurementbudgets', 'create', 'Buat anggaran procurement'],
            ['PUT', 'budgets/*', 'procurementbudgets', 'edit', 'Ubah anggaran procurement'],
            ['DELETE', 'budgets/*', 'procurementbudgets', 'delete', 'Hapus anggaran procurement'],
            ['POST', 'budgets/*/activate', 'procurementbudgets', 'edit', 'Aktifkan anggaran procurement'],
            ['POST', 'budgets/*/close', 'procurementbudgets', 'edit', 'Tutup anggaran procurement'],
            ['GET', 'budgets/*/commitments', 'procurementbudgets', 'view', 'Lihat komitmen anggaran'],

            ['GET', 'procurement-contracts', 'procurementcontracts', 'view', 'Lihat kontrak procurement'],
            ['POST', 'procurement-contracts', 'procurementcontracts', 'create', 'Buat kontrak procurement'],
            ['GET', 'procurement-contracts/*', 'procurementcontracts', 'view', 'Detail kontrak procurement'],
            ['PUT', 'procurement-contracts/*', 'procurementcontracts', 'edit', 'Ubah kontrak procurement'],
            ['DELETE', 'procurement-contracts/*', 'procurementcontracts', 'delete', 'Hapus kontrak procurement'],
            ['POST', 'procurement-contracts/*/activate', 'procurementcontracts', 'edit', 'Aktifkan kontrak procurement'],
            ['POST', 'procurement-contracts/*/close', 'procurementcontracts', 'edit', 'Tutup kontrak procurement'],
            ['POST', 'procurement-contracts/*/cancel', 'procurementcontracts', 'edit', 'Batalkan kontrak procurement'],
            ['POST', 'procurement-contracts/*/release-po', 'procurementcontracts', 'edit', 'Release PO dari kontrak'],

            ['GET', 'procurement-plans', 'procurementplans', 'view', 'Lihat rencana procurement'],
            ['POST', 'procurement-plans', 'procurementplans', 'create', 'Buat rencana procurement'],
            ['GET', 'procurement-plans/*', 'procurementplans', 'view', 'Detail rencana procurement'],
            ['PUT', 'procurement-plans/*', 'procurementplans', 'edit', 'Ubah rencana procurement'],
            ['DELETE', 'procurement-plans/*', 'procurementplans', 'delete', 'Hapus rencana procurement'],
            ['POST', 'procurement-plans/*/activate', 'procurementplans', 'edit', 'Aktifkan rencana procurement'],
            ['POST', 'procurement-plans/*/close', 'procurementplans', 'edit', 'Tutup rencana procurement'],

            ['GET', 'approval-matrix', 'approvalmatrix', 'view', 'Lihat matrix approval'],
            ['POST', 'approval-matrix', 'approvalmatrix', 'create', 'Buat aturan matrix approval'],
            ['GET', 'approval-matrix/*', 'approvalmatrix', 'view', 'Detail matrix approval'],
            ['PUT', 'approval-matrix/*', 'approvalmatrix', 'edit', 'Ubah matrix approval'],
            ['DELETE', 'approval-matrix/*', 'approvalmatrix', 'delete', 'Hapus matrix approval'],

            ['GET', 'approval-delegations', 'approvaldelegations', 'view', 'Lihat delegasi approval'],
            ['POST', 'approval-delegations', 'approvaldelegations', 'create', 'Buat delegasi approval'],
            ['GET', 'approval-delegations/*', 'approvaldelegations', 'view', 'Detail delegasi approval'],
            ['PUT', 'approval-delegations/*', 'approvaldelegations', 'edit', 'Ubah delegasi approval'],
            ['DELETE', 'approval-delegations/*', 'approvaldelegations', 'delete', 'Hapus delegasi approval'],

            ['GET', 'purchase-requisitions/*/field-audits', 'purchaserequisitions', 'view', 'Audit field PR'],
            ['GET', 'purchase-orders/*/field-audits', 'purchaseorders', 'view', 'Audit field PO'],

            ['GET', 'procurement-planning/auto-reorder/preview', 'procurementdashboard', 'view', 'Preview auto-reorder'],
            ['POST', 'procurement-planning/auto-reorder/run', 'procurementdashboard', 'edit', 'Jalankan auto-reorder'],
            ['GET', 'procurement-planning/demand/forecasts', 'procurementdashboard', 'view', 'Lihat forecast demand'],
            ['POST', 'procurement-planning/demand/generate', 'procurementdashboard', 'edit', 'Generate forecast demand'],
            ['POST', 'procurement-planning/demand/suggest-pr', 'procurementdashboard', 'edit', 'Buat PR dari forecast'],

            ['GET', 'goods-receipts/*/landed-cost', 'goodsreceipts', 'view', 'Lihat landed cost GR'],
            ['PUT', 'goods-receipts/*/landed-cost', 'goodsreceipts', 'edit', 'Ubah landed cost GR'],

            ['GET', 'rfqs', 'rfqs', 'view', 'Lihat RFQ'],
            ['POST', 'rfqs', 'rfqs', 'create', 'Buat RFQ'],
            ['GET', 'rfqs/*', 'rfqs', 'view', 'Detail RFQ'],
            ['PUT', 'rfqs/*', 'rfqs', 'edit', 'Ubah RFQ'],
            ['DELETE', 'rfqs/*', 'rfqs', 'delete', 'Hapus RFQ'],
            ['POST', 'rfqs/*/send', 'rfqs', 'edit', 'Kirim RFQ'],
            ['POST', 'rfqs/*/close', 'rfqs', 'edit', 'Tutup RFQ'],
            ['POST', 'rfqs/*/cancel', 'rfqs', 'edit', 'Batalkan RFQ'],
            ['GET', 'rfqs/*/compare', 'rfqs', 'view', 'Banding quote RFQ'],
            ['PUT', 'rfqs/*/quotes/*', 'rfqs', 'edit', 'Input quote supplier'],
            ['POST', 'rfqs/*/quotes/*/submit', 'rfqs', 'edit', 'Ajukan quote supplier'],
            ['POST', 'rfqs/*/select-winner', 'rfqs', 'edit', 'Pilih pemenang quote'],
            ['POST', 'rfqs/*/create-pr', 'rfqs', 'edit', 'Buat PR dari RFQ'],

            ['GET', 'assets', 'fixedassets', 'view', 'Lihat aset tetap'],
            ['GET', 'assets/*', 'fixedassets', 'view', 'Detail aset tetap'],
            ['PUT', 'assets/*', 'fixedassets', 'edit', 'Ubah aset tetap'],

            ['GET', 'supplier-product-prices', 'supplierpricelists', 'view', 'Lihat daftar harga supplier'],
            ['POST', 'supplier-product-prices', 'supplierpricelists', 'create', 'Buat harga supplier'],
            ['GET', 'supplier-product-prices/*', 'supplierpricelists', 'view', 'Detail harga supplier'],
            ['PUT', 'supplier-product-prices/*', 'supplierpricelists', 'edit', 'Ubah harga supplier'],
            ['DELETE', 'supplier-product-prices/*', 'supplierpricelists', 'delete', 'Hapus harga supplier'],
            ['GET', 'supplier-product-prices/lookup', 'supplierpricelists', 'view', 'Lookup harga supplier'],

            ['POST', 'procurement/attachments', 'procurementdashboard', 'create', 'Unggah lampiran procurement'],
            ['DELETE', 'procurement/attachments/*', 'procurementdashboard', 'delete', 'Hapus lampiran procurement'],
        ];
    }
}
