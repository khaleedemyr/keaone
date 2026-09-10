<?php

namespace App\Services;

use App\Mail\StorefrontInquiryMail;
use App\Models\Company;
use App\Models\Product;
use App\Models\ProductVariantOption;
use App\Models\Storefront;
use App\Models\StorefrontInquiry;
use App\Models\StorefrontNewsPost;
use App\Models\StorefrontOrder;
use App\Models\StorefrontOrderItem;
use App\Models\StorefrontPage;
use App\Models\StorefrontProduct;
use App\Support\InventorySettings;
use App\Support\StorefrontCatalog;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class StorefrontService
{
    public function forCompany(Company $company): Storefront
    {
        $existing = Storefront::query()->withoutGlobalScopes()->where('company_id', $company->id)->first();
        if ($existing) {
            $this->migrateRetiredTemplate($existing);

            return $existing;
        }

        return DB::transaction(function () use ($company) {
            $defaults = StorefrontCatalog::defaults();

            $storefront = Storefront::query()->create([
                'company_id' => $company->id,
                'site_kind' => $defaults['site_kind'] ?? 'landing',
                'template_key' => $defaults['template_key'] ?? 'landing_dilabs',
                'status' => $defaults['status'] ?? 'draft',
                'title' => $company->name,
                'stock_mode' => $defaults['stock_mode'] ?? 'realtime',
                'brand_colors' => $defaults['brand_colors'] ?? null,
                'theme_content' => $defaults['theme_content'] ?? [],
                'bank_accounts' => [],
                'outlet_id' => $company->outlets()->orderByDesc('is_default')->value('id'),
            ]);

            $homeBlocks = StorefrontCatalog::presetBlocksFor((string) $storefront->template_key);
            if (isset($homeBlocks[0]) && $homeBlocks[0]['type'] === 'hero') {
                $homeBlocks[0]['props']['headline'] = (string) $company->name;
            }

            StorefrontPage::query()->create([
                'company_id' => $company->id,
                'storefront_id' => $storefront->id,
                'slug' => 'home',
                'title' => 'Beranda',
                'kind' => 'home',
                'content' => [
                    'blocks' => $homeBlocks,
                ],
                'sort_order' => 0,
                'is_published' => true,
            ]);

            return $storefront->fresh(['domains', 'pages', 'outlet:id,name', 'warehouse:id,name']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Storefront $storefront, array $data): Storefront
    {
        if (isset($data['site_kind'], $data['template_key'])) {
            $this->assertTemplate($data['template_key'], $data['site_kind']);
        } elseif (isset($data['template_key'])) {
            $this->assertTemplate($data['template_key'], $data['site_kind'] ?? $storefront->site_kind);
        } elseif (isset($data['site_kind'])) {
            $kind = $data['site_kind'];
            $template = $data['template_key'] ?? $storefront->template_key;
            if (! StorefrontCatalog::templateExists((string) $template, $kind)) {
                $fallback = StorefrontCatalog::templates($kind)[0]['key'] ?? null;
                if (! $fallback) {
                    throw ValidationException::withMessages([
                        'site_kind' => 'Tidak ada template untuk jenis situs ini.',
                    ]);
                }
                $data['template_key'] = $fallback;
            }
        }

        if (($data['status'] ?? null) === 'published') {
            $this->assertPublishReady($storefront, $data);
        }

        if (($data['status'] ?? null) === 'published' && empty($storefront->published_at) && empty($data['published_at'])) {
            $data['published_at'] = now();
        }

        if (array_key_exists('theme_content', $data)) {
            $templateKey = (string) ($data['template_key'] ?? $storefront->template_key);
            $raw = is_array($data['theme_content']) ? $data['theme_content'] : [];
            $data['theme_content'] = StorefrontCatalog::sanitizeThemeContent($templateKey, $raw);
        }

        if (array_key_exists('brand_colors', $data)) {
            $data['brand_colors'] = StorefrontCatalog::sanitizeBrandColors(
                is_array($data['brand_colors']) ? $data['brand_colors'] : null,
            );
        }

        if (array_key_exists('shipping', $data)) {
            $data['shipping'] = $this->sanitizeShippingConfig(
                is_array($data['shipping']) ? $data['shipping'] : [],
                is_array($storefront->shipping) ? $storefront->shipping : [],
            );
        }

        $applyPreset = (bool) ($data['apply_preset'] ?? false);
        unset($data['apply_preset']);

        $storefront->fill($data);
        $storefront->save();

        if ($applyPreset) {
            $this->applyHomePreset($storefront->fresh());
        }

        return $storefront->fresh([
            'domains',
            'pages',
            'outlet:id,name',
            'warehouse:id,name',
            'priceChannel:id,name,code',
        ]);
    }

    public function homePage(Storefront $storefront, bool $persistMigrate = true): StorefrontPage
    {
        $page = $this->ensureHomePage($storefront);
        $content = is_array($page->content) ? $page->content : [];
        $rawBlocks = is_array($content['blocks'] ?? null) ? $content['blocks'] : [];
        $theme = is_array($storefront->theme_content) ? $storefront->theme_content : [];

        $looksLegacySeed = $rawBlocks === []
            || (
                count($rawBlocks) === 1
                && (($rawBlocks[0]['type'] ?? null) === 'hero')
                && ! isset($rawBlocks[0]['props'])
            );

        if ($looksLegacySeed && $theme !== []) {
            $normalized = StorefrontCatalog::sanitizeBlocks(StorefrontCatalog::themeContentToBlocks(
                (string) $storefront->template_key,
                $theme,
                [
                    'title' => $storefront->title,
                    'tagline' => $storefront->tagline,
                    'about' => $storefront->about,
                ],
            ));
            if ($persistMigrate) {
                $page->forceFill(['content' => ['blocks' => $normalized]])->save();
            }
        } else {
            $normalized = StorefrontCatalog::sanitizeBlocks(StorefrontCatalog::normalizeLegacyBlocks($rawBlocks));
            if ($persistMigrate && $looksLegacySeed && $normalized !== []) {
                $page->forceFill(['content' => ['blocks' => $normalized]])->save();
            }
        }

        if ($normalized === []) {
            $normalized = StorefrontCatalog::presetBlocksFor((string) $storefront->template_key);
            if (isset($normalized[0]) && $normalized[0]['type'] === 'hero') {
                $normalized[0]['props']['headline'] = (string) ($storefront->title ?? '');
            }
            if ($persistMigrate) {
                $page->forceFill(['content' => ['blocks' => $normalized]])->save();
            }
        }

        $page->setAttribute('content', ['blocks' => $normalized]);

        return $page;
    }

    /**
     * @param  list<array<string, mixed>>  $blocks
     */
    public function updateHomeBlocks(Storefront $storefront, array $blocks): StorefrontPage
    {
        $page = $this->ensureHomePage($storefront);
        $clean = StorefrontCatalog::sanitizeBlocks($blocks);
        $page->forceFill(['content' => ['blocks' => $clean]])->save();

        return $page->fresh();
    }

    public function applyHomePreset(Storefront $storefront): StorefrontPage
    {
        $theme = is_array($storefront->theme_content) ? $storefront->theme_content : [];
        if ($theme !== []) {
            $blocks = StorefrontCatalog::themeContentToBlocks(
                (string) $storefront->template_key,
                $theme,
                [
                    'title' => $storefront->title,
                    'tagline' => $storefront->tagline,
                    'about' => $storefront->about,
                ],
            );
        } else {
            $blocks = StorefrontCatalog::presetBlocksFor((string) $storefront->template_key);
            foreach ($blocks as $i => $block) {
                if ($block['type'] === 'hero') {
                    $blocks[$i]['props']['headline'] = (string) ($storefront->title ?? '');
                    $blocks[$i]['props']['subheadline'] = (string) ($storefront->tagline ?? '');
                }
                if ($block['type'] === 'rich_text') {
                    $blocks[$i]['props']['body'] = (string) ($storefront->about ?? '');
                }
                if ($block['type'] === 'product_grid' && ($blocks[$i]['props']['title'] ?? '') === '') {
                    $blocks[$i]['props']['title'] = 'Produk';
                }
            }
        }

        return $this->updateHomeBlocks($storefront, $blocks);
    }

    /**
     * @return array<string, mixed>
     */
    public function toHomePageArray(Storefront $storefront, StorefrontPage $page): array
    {
        $content = is_array($page->content) ? $page->content : [];
        $blocks = is_array($content['blocks'] ?? null) ? $content['blocks'] : [];

        return [
            'id' => $page->id,
            'slug' => $page->slug,
            'title' => $page->title,
            'kind' => $page->kind,
            'is_published' => $page->is_published,
            'blocks' => $blocks,
            'block_types' => StorefrontCatalog::blockTypes(),
            'template_key' => $storefront->template_key,
            'site_kind' => $storefront->site_kind,
            'brand_colors' => $storefront->brand_colors,
            'title_site' => $storefront->title,
            'tagline' => $storefront->tagline,
            'about' => $storefront->about,
            'logo_url' => $storefront->logoUrl(),
            'contact_email' => $storefront->contact_email,
            'contact_phone' => $storefront->contact_phone,
            'contact_address' => $storefront->contact_address,
            'bank_accounts' => $storefront->bank_accounts ?? [],
            'shipping' => $this->shippingAdminPayload($storefront),
            'theme_content' => is_array($storefront->theme_content) ? $storefront->theme_content : [],
            'theme_defaults' => StorefrontCatalog::defaultThemeContent((string) $storefront->template_key),
            'template_slots' => StorefrontCatalog::slotsFor((string) $storefront->template_key),
            'stock_mode' => $storefront->stock_mode,
        ];
    }

    /**
     * Public / preview-safe shipping config (no API key).
     *
     * @return array{enabled: bool, configured: bool, origin_label: string|null, couriers: list<string>, default_weight_gram: int}
     */
    public function shippingPublicPayload(Storefront $storefront): array
    {
        $shipping = is_array($storefront->shipping) ? $storefront->shipping : [];
        $enabled = (bool) ($shipping['enabled'] ?? false);
        $raja = app(RajaOngkirService::class);

        return [
            'enabled' => $enabled,
            'configured' => $enabled && $raja->isConfigured($storefront),
            'origin_label' => isset($shipping['origin_label']) ? (string) $shipping['origin_label'] : null,
            'couriers' => $this->normalizeCourierList($shipping['couriers'] ?? null),
            'default_weight_gram' => max(1, (int) ($shipping['default_weight_gram'] ?? config('rajaongkir.default_weight_gram', 500))),
        ];
    }

    /**
     * @return array{enabled: bool, origin_id: int|null, origin_label: string|null, couriers: list<string>, default_weight_gram: int, has_api_key: bool, api_key_set: bool}
     */
    public function shippingAdminPayload(Storefront $storefront): array
    {
        $shipping = is_array($storefront->shipping) ? $storefront->shipping : [];
        $platformKey = trim((string) config('rajaongkir.api_key', ''));
        $enabled = (bool) ($shipping['enabled'] ?? false);
        $hasKey = $platformKey !== '';
        $originId = isset($shipping['origin_id']) ? (int) $shipping['origin_id'] : null;

        return [
            'enabled' => $enabled,
            'configured' => $enabled && $hasKey && $originId !== null && $originId > 0,
            'origin_id' => $originId,
            'origin_label' => isset($shipping['origin_label']) ? (string) $shipping['origin_label'] : null,
            'couriers' => $this->normalizeCourierList($shipping['couriers'] ?? null),
            'default_weight_gram' => max(1, (int) ($shipping['default_weight_gram'] ?? config('rajaongkir.default_weight_gram', 500))),
            'has_api_key' => $hasKey,
        ];
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    public function sanitizeShippingConfig(array $incoming, array $existing = []): array
    {
        $enabled = (bool) ($incoming['enabled'] ?? false);
        $originId = isset($incoming['origin_id']) && $incoming['origin_id'] !== '' && $incoming['origin_id'] !== null
            ? (int) $incoming['origin_id']
            : null;
        if ($originId !== null && $originId <= 0) {
            $originId = null;
        }

        return [
            'enabled' => $enabled,
            'origin_id' => $originId,
            'origin_label' => isset($incoming['origin_label'])
                ? trim((string) $incoming['origin_label'])
                : ($existing['origin_label'] ?? null),
            'couriers' => $this->normalizeCourierList($incoming['couriers'] ?? $existing['couriers'] ?? null),
            'default_weight_gram' => max(1, min(30000, (int) ($incoming['default_weight_gram'] ?? $existing['default_weight_gram'] ?? config('rajaongkir.default_weight_gram', 500)))),
            // API key is platform-only (.env). Never accept per-store keys from the client.
            'api_key' => null,
        ];
    }

    /**
     * @param  mixed  $raw
     * @return list<string>
     */
    public function normalizeCourierList($raw): array
    {
        if (is_string($raw) && trim($raw) !== '') {
            $raw = preg_split('/[,:;|\s]+/', strtolower($raw)) ?: [];
        }
        if (! is_array($raw)) {
            $raw = config('rajaongkir.default_couriers', ['jne', 'sicepat', 'jnt']);
        }
        $out = [];
        foreach ($raw as $code) {
            $code = strtolower(trim((string) $code));
            if ($code !== '' && preg_match('/^[a-z0-9]+$/', $code)) {
                $out[] = $code;
            }
        }
        $out = array_values(array_unique($out));

        return $out !== [] ? $out : ['jne', 'sicepat', 'jnt'];
    }

    /**
     * Weight in grams for cart lines (product weight × qty, fallback to storefront default).
     *
     * @param  list<array{product_id?: mixed, qty?: mixed}>  $items
     */
    public function estimateCartWeightGram(Storefront $storefront, array $items): int
    {
        $shipping = is_array($storefront->shipping) ? $storefront->shipping : [];
        $defaultPerItem = max(1, (int) ($shipping['default_weight_gram'] ?? config('rajaongkir.default_weight_gram', 500)));

        $productIds = [];
        foreach ($items as $item) {
            $pid = (int) ($item['product_id'] ?? 0);
            if ($pid > 0) {
                $productIds[$pid] = true;
            }
        }

        $weights = [];
        if ($productIds !== []) {
            $weights = Product::query()
                ->withoutGlobalScopes()
                ->where('company_id', $storefront->company_id)
                ->whereIn('id', array_keys($productIds))
                ->pluck('weight_gram', 'id')
                ->all();
        }

        $total = 0;
        $hasQty = false;
        foreach ($items as $item) {
            $qty = max(0, (int) ($item['qty'] ?? 0));
            if ($qty <= 0) {
                continue;
            }
            $hasQty = true;
            $pid = (int) ($item['product_id'] ?? 0);
            $per = isset($weights[$pid]) && $weights[$pid] !== null && (int) $weights[$pid] > 0
                ? (int) $weights[$pid]
                : $defaultPerItem;
            $total += $per * $qty;
        }

        return max(1, $hasQty ? $total : $defaultPerItem);
    }

    /**
     * @return list<array{id: string, type: string, visible: bool, props: array<string, mixed>}>
     */
    public function homeBlocksForPublic(Storefront $storefront): array
    {
        $page = $this->homePage($storefront, persistMigrate: false);
        $content = is_array($page->content) ? $page->content : [];

        return is_array($content['blocks'] ?? null) ? $content['blocks'] : [];
    }

    public function ensureHomePage(Storefront $storefront): StorefrontPage
    {
        $page = StorefrontPage::query()
            ->withoutGlobalScopes()
            ->where('storefront_id', $storefront->id)
            ->where('kind', 'home')
            ->first();

        if ($page) {
            return $page;
        }

        $blocks = StorefrontCatalog::presetBlocksFor((string) $storefront->template_key);
        if (isset($blocks[0]) && $blocks[0]['type'] === 'hero') {
            $blocks[0]['props']['headline'] = (string) ($storefront->title ?? '');
        }

        return StorefrontPage::query()->create([
            'company_id' => $storefront->company_id,
            'storefront_id' => $storefront->id,
            'slug' => 'home',
            'title' => 'Beranda',
            'kind' => 'home',
            'content' => ['blocks' => $blocks],
            'sort_order' => 0,
            'is_published' => true,
        ]);
    }

    public function assertTemplate(string $key, string $kind): void
    {
        if (! in_array($kind, ['landing', 'shop'], true)) {
            throw ValidationException::withMessages([
                'site_kind' => 'Jenis situs tidak valid.',
            ]);
        }

        if (! StorefrontCatalog::templateExists($key, $kind)) {
            throw ValidationException::withMessages([
                'template_key' => 'Template tidak cocok dengan jenis situs.',
            ]);
        }
    }

    /** Map removed template keys to their replacements (in-place). */
    private function migrateRetiredTemplate(Storefront $storefront): void
    {
        $map = [
            'shop_compact' => 'shop_nexora',
            'shop_classic' => 'shop_nexora',
            'landing_minimal' => 'landing_dilabs',
        ];

        $next = $map[$storefront->template_key] ?? null;
        if (! $next) {
            return;
        }

        $storefront->template_key = $next;
        $storefront->save();
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminArray(Storefront $storefront): array
    {
        $this->migrateRetiredTemplate($storefront);

        $storefront->loadMissing([
            'domains',
            'pages',
            'outlet:id,name',
            'warehouse:id,name',
            'priceChannel:id,name,code',
        ]);

        return [
            'id' => $storefront->id,
            'company_id' => $storefront->company_id,
            'outlet_id' => $storefront->outlet_id,
            'outlet' => $storefront->outlet,
            'warehouse_id' => $storefront->warehouse_id,
            'warehouse' => $storefront->warehouse,
            'price_channel_id' => $storefront->price_channel_id,
            'price_channel' => $storefront->priceChannel,
            'site_kind' => $storefront->site_kind,
            'template_key' => $storefront->template_key,
            'status' => $storefront->status,
            'title' => $storefront->title,
            'tagline' => $storefront->tagline,
            'about' => $storefront->about,
            'logo_path' => $storefront->logo_path,
            'logo_url' => $storefront->logoUrl(),
            'brand_colors' => $storefront->brand_colors,
            'theme_content' => is_array($storefront->theme_content) ? $storefront->theme_content : [],
            'theme_defaults' => StorefrontCatalog::defaultThemeContent((string) $storefront->template_key),
            'template_slots' => StorefrontCatalog::slotsFor((string) $storefront->template_key),
            'block_types' => StorefrontCatalog::blockTypes(),
            'home_blocks' => $this->homeBlocksForPublic($storefront),
            'bank_accounts' => $storefront->bank_accounts ?? [],
            'shipping' => $this->shippingAdminPayload($storefront),
            'stock_mode' => $storefront->stock_mode,
            'contact_email' => $storefront->contact_email,
            'contact_phone' => $storefront->contact_phone,
            'contact_address' => $storefront->contact_address,
            'seo_title' => $storefront->seo_title,
            'seo_description' => $storefront->seo_description,
            'published_at' => $storefront->published_at,
            'domains' => $storefront->domains,
            'pages' => $storefront->pages,
            'templates' => [
                'landing' => StorefrontCatalog::templates('landing'),
                'shop' => StorefrontCatalog::templates('shop'),
            ],
            'dns_instructions' => StorefrontCatalog::dnsInstructions(),
            'publish_readiness' => $this->publishReadiness($storefront),
            'has_news' => StorefrontCatalog::templateHas((string) $storefront->template_key, 'has_news'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function newsPostToArray(StorefrontNewsPost $post): array
    {
        $published = $post->published_at;

        return [
            'id' => $post->id,
            'slug' => $post->slug,
            'title' => $post->title,
            'excerpt' => $post->excerpt,
            'body' => $post->body,
            'image_path' => $post->image_path,
            'image_url' => $post->imageUrl(),
            'tags' => $post->tags,
            'sort_order' => (int) $post->sort_order,
            'is_published' => (bool) $post->is_published,
            'published_at' => optional($published)?->toIso8601String(),
            'day' => $published ? $published->format('d') : null,
            'month' => $published ? $published->format('M') : null,
            'created_at' => optional($post->created_at)?->toIso8601String(),
            'updated_at' => optional($post->updated_at)?->toIso8601String(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function publishedNewsPayload(Storefront $storefront, int $limit = 24): array
    {
        if (! StorefrontCatalog::templateHas((string) $storefront->template_key, 'has_news')) {
            return [];
        }

        return $storefront->newsPosts()
            ->where('is_published', true)
            ->orderBy('sort_order')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(max(1, min(48, $limit)))
            ->get()
            ->map(fn (StorefrontNewsPost $post) => $this->newsPostToArray($post))
            ->values()
            ->all();
    }

    public function uniqueNewsSlug(Storefront $storefront, string $title, ?int $ignoreId = null): string
    {
        $base = \Illuminate\Support\Str::slug(\Illuminate\Support\Str::limit(trim($title), 80, '')) ?: 'berita';
        $slug = $base;
        $n = 2;
        while (
            StorefrontNewsPost::query()
                ->where('storefront_id', $storefront->id)
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = $base.'-'.$n;
            $n++;
        }

        return \Illuminate\Support\Str::limit($slug, 160, '');
    }

    /**
     * Shop publish checklist (same rules as assertPublishReady). Landing always ready.
     *
     * @return array{ready: bool, site_kind: string, items: list<array{key: string, ok: bool}>}
     */
    public function publishReadiness(Storefront $storefront, array $data = []): array
    {
        $siteKind = (string) ($data['site_kind'] ?? $storefront->site_kind);
        if ($siteKind !== 'shop') {
            return [
                'ready' => true,
                'site_kind' => $siteKind,
                'items' => [],
            ];
        }

        $banks = array_key_exists('bank_accounts', $data) ? $data['bank_accounts'] : $storefront->bank_accounts;
        $banks = is_array($banks) ? $banks : [];
        $validBanks = array_values(array_filter($banks, function ($row) {
            if (! is_array($row)) {
                return false;
            }

            return trim((string) ($row['bank_name'] ?? '')) !== ''
                && trim((string) ($row['account_name'] ?? '')) !== ''
                && trim((string) ($row['account_number'] ?? '')) !== '';
        }));

        $shipping = array_key_exists('shipping', $data)
            ? (is_array($data['shipping']) ? $data['shipping'] : [])
            : (is_array($storefront->shipping) ? $storefront->shipping : []);
        $shippingOk = true;
        if ((bool) ($shipping['enabled'] ?? false)) {
            $probe = clone $storefront;
            $probe->shipping = $this->sanitizeShippingConfig(
                $shipping,
                is_array($storefront->shipping) ? $storefront->shipping : [],
            );
            $shippingOk = app(RajaOngkirService::class)->isConfigured($probe);
        }

        $hasVisibleProduct = StorefrontProduct::query()
            ->withoutGlobalScopes()
            ->where('storefront_id', $storefront->id)
            ->where('company_id', $storefront->company_id)
            ->where('is_visible', true)
            ->whereHas('product', fn ($q) => $q->withoutGlobalScopes()->where('is_active', true))
            ->exists();

        $items = [
            ['key' => 'bank', 'ok' => $validBanks !== []],
            ['key' => 'shipping', 'ok' => $shippingOk],
            ['key' => 'products', 'ok' => $hasVisibleProduct],
        ];

        return [
            'ready' => collect($items)->every(fn (array $row) => $row['ok']),
            'site_kind' => $siteKind,
            'items' => $items,
        ];
    }

    /**
     * @return array{path: string, url: string}
     */
    public function storeMedia(Storefront $storefront, \Illuminate\Http\UploadedFile $uploaded): array
    {
        abort_unless($uploaded->isValid(), 422, 'Unggahan gambar gagal.');

        $info = @getimagesize($uploaded->getRealPath() ?: $uploaded->getPathname());
        abort_unless($info !== false, 422, 'File bukan gambar yang valid.');

        $ext = match ($info[2] ?? 0) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        };
        abort_unless($ext, 422, 'Format gambar tidak didukung. Pakai JPG, PNG, atau WebP.');

        $dir = storage_path('app/public/storefront');
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder media storefront.');
        }

        $name = $storefront->company_id.'_'.\Illuminate\Support\Str::uuid().'.'.$ext;
        $uploaded->move($dir, $name);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$name), 422, 'Tidak bisa menyimpan gambar.');

        $path = 'storefront/'.$name;

        return [
            'path' => $path,
            'url' => '/media/storefront/'.$name,
        ];
    }

    /**
     * @return array{path: string, url: string}
     */
    public function storeLogo(Storefront $storefront, \Illuminate\Http\UploadedFile $uploaded): array
    {
        $media = $this->storeMedia($storefront, $uploaded);

        if (is_string($storefront->logo_path) && $storefront->logo_path !== '') {
            $old = basename($storefront->logo_path);
            if (preg_match('/^[A-Za-z0-9._-]+$/', $old) === 1) {
                $oldPath = storage_path('app/public/storefront/'.$old);
                if (is_file($oldPath)) {
                    @unlink($oldPath);
                }
            }
        }

        $storefront->forceFill(['logo_path' => $media['path']])->save();

        return $media;
    }

    public function destroyLogo(Storefront $storefront): void
    {
        if (is_string($storefront->logo_path) && $storefront->logo_path !== '') {
            $file = basename($storefront->logo_path);
            if (preg_match('/^[A-Za-z0-9._-]+$/', $file) === 1) {
                $path = storage_path('app/public/storefront/'.$file);
                if (is_file($path)) {
                    @unlink($path);
                }
            }
        }

        $storefront->forceFill(['logo_path' => null])->save();
    }

    /**
     * @return array<string, mixed>
     */
    public function publicProductPayload(\App\Models\StorefrontProduct $row, Storefront $storefront): array
    {
        $product = $row->product;
        $available = null;
        if ($storefront->stock_mode === 'allocated') {
            $remaining = $row->remainingAllocated();
            if ($remaining !== null) {
                $available = max(0, $remaining - $this->pendingAllocatedQty($storefront, (int) $row->product_id));
            }
        } elseif ($storefront->stock_mode === 'realtime' && $product?->track_stock) {
            $available = $this->realtimeAvailableQty($storefront, (int) $row->product_id);
        }

        $imageUrl = null;
        $cover = $product?->images?->first();
        if ($cover) {
            $imageUrl = $cover->url();
        }

        return [
            'id' => $row->id,
            'product_id' => $row->product_id,
            'name' => $product?->name,
            'sku' => $product?->sku,
            'description' => $product?->description,
            'category_id' => $product?->category_id,
            'price' => $this->unitPriceFor($storefront, $row),
            'weight_gram' => $product?->weight_gram !== null ? (int) $product->weight_gram : null,
            'available_qty' => $available,
            'stock_mode' => $storefront->stock_mode,
            'image_url' => $imageUrl,
            'images' => $product?->images
                ? $product->images->map(fn ($img) => [
                    'id' => $img->id,
                    'url' => $img->url(),
                    'is_primary' => (bool) $img->is_primary,
                ])->filter(fn ($img) => ! empty($img['url']))->values()->all()
                : [],
            'variant_attributes' => $product
                ? app(ProductVariantService::class)->serialize($product, storefrontOnly: true)
                : [],
            'is_deal' => (bool) $row->is_deal,
            'is_new_arrival' => (bool) $row->is_new_arrival,
            'is_bestseller' => (bool) $row->is_bestseller,
            'sold_count' => (int) $row->units_sold,
            'avg_rating' => round((float) $row->avg_rating, 2),
            'review_count' => (int) $row->review_count,
        ];
    }

    /**
     * Qty already held by unpaid storefront orders (allocated mode).
     */
    public function pendingAllocatedQty(Storefront $storefront, int $productId, ?int $excludeOrderId = null): int
    {
        return (int) StorefrontOrderItem::query()
            ->withoutGlobalScopes()
            ->where('company_id', $storefront->company_id)
            ->where('product_id', $productId)
            ->whereHas('order', function ($q) use ($storefront, $excludeOrderId) {
                $q->withoutGlobalScopes()
                    ->where('storefront_id', $storefront->id)
                    ->whereIn('status', ['pending_payment', 'awaiting_confirmation']);
                if ($excludeOrderId) {
                    $q->where('id', '!=', $excludeOrderId);
                }
            })
            ->sum('qty');
    }

    public function realtimeAvailableQty(Storefront $storefront, int $productId): ?int
    {
        $warehouseId = $this->resolveStorefrontWarehouseId($storefront);
        if (! $warehouseId) {
            return null;
        }

        return app(InventoryService::class)->qtyAtWarehouse($warehouseId, $productId);
    }

    public function resolveStorefrontWarehouseId(Storefront $storefront): ?int
    {
        if ($storefront->warehouse_id) {
            return (int) $storefront->warehouse_id;
        }
        if ($storefront->outlet_id) {
            return (int) app(InventoryService::class)
                ->resolveDefaultWarehouse((int) $storefront->company_id, (int) $storefront->outlet_id)
                ->id;
        }

        return null;
    }

    /**
     * @param  array{
     *   customer_name: string,
     *   customer_phone?: string|null,
     *   customer_email?: string|null,
     *   customer_address?: string|null,
     *   note?: string|null,
     *   client_uuid: string,
     *   contact_id?: int|null,
     *   items: list<array{product_id: int, qty: int}>
     * }  $payload
     */
    public function placeOrder(Storefront $storefront, array $payload): StorefrontOrder
    {
        if (! $storefront->isShop()) {
            throw ValidationException::withMessages([
                'storefront' => 'Checkout hanya tersedia untuk toko online.',
            ]);
        }

        $clientUuid = (string) $payload['client_uuid'];
        $existing = StorefrontOrder::query()
            ->withoutGlobalScopes()
            ->where('company_id', $storefront->company_id)
            ->where('client_uuid', $clientUuid)
            ->first();
        if ($existing) {
            return $existing->load(['items']);
        }

        $itemsInput = $payload['items'] ?? [];
        if (! is_array($itemsInput) || $itemsInput === []) {
            throw ValidationException::withMessages([
                'items' => 'Keranjang kosong.',
            ]);
        }

        try {
            return DB::transaction(function () use ($storefront, $payload, $itemsInput, $clientUuid) {
                $again = StorefrontOrder::query()
                    ->withoutGlobalScopes()
                    ->where('company_id', $storefront->company_id)
                    ->where('client_uuid', $clientUuid)
                    ->first();
                if ($again) {
                    return $again->load(['items']);
                }

                $lines = [];
                $subtotal = 0;

                foreach ($itemsInput as $index => $raw) {
                    $productId = (int) ($raw['product_id'] ?? 0);
                    $qty = (int) ($raw['qty'] ?? 0);
                    if ($productId <= 0 || $qty <= 0) {
                        throw ValidationException::withMessages([
                            "items.$index" => 'Item tidak valid.',
                        ]);
                    }

                    $row = StorefrontProduct::query()
                        ->withoutGlobalScopes()
                        ->with([
                            'product' => fn ($q) => $q->withoutGlobalScopes()
                                ->with(['variantAttributes.options']),
                        ])
                        ->where('storefront_id', $storefront->id)
                        ->where('company_id', $storefront->company_id)
                        ->where('product_id', $productId)
                        ->where('is_visible', true)
                        ->lockForUpdate()
                        ->first();

                    if (! $row || ! $row->product || ! $row->product->is_active) {
                        throw ValidationException::withMessages([
                            "items.$index" => 'Produk tidak tersedia.',
                        ]);
                    }

                    $this->assertOrderStockAvailable($storefront, $row, $qty, $index);

                    $variant = $this->resolveOrderVariantSelections($row->product, $raw['selected_options'] ?? null, $index);
                    $unit = $this->unitPriceFor($storefront, $row) + (int) ($variant['extra_price'] ?? 0);
                    $lineTotal = $unit * $qty;
                    $subtotal += $lineTotal;
                    $nameSnapshot = (string) $row->product->name;
                    if (! empty($variant['label'])) {
                        $nameSnapshot .= ' ('.$variant['label'].')';
                    }
                    $lines[] = [
                        'company_id' => $storefront->company_id,
                        'product_id' => $productId,
                        'name_snapshot' => $nameSnapshot,
                        'variant_snapshot' => $variant['snapshot'],
                        'qty' => $qty,
                        'unit_price' => $unit,
                        'line_total' => $lineTotal,
                    ];
                }

                $number = $this->nextOrderNumber($storefront);
                $banks = is_array($storefront->bank_accounts) ? $storefront->bank_accounts : [];

                $shippingCost = 0;
                $shippingSnapshot = null;
                $raja = app(RajaOngkirService::class);
                $shippingCfg = is_array($storefront->shipping) ? $storefront->shipping : [];
                $shippingEnabled = (bool) ($shippingCfg['enabled'] ?? false);
                if ($shippingEnabled && ! $raja->isConfigured($storefront)) {
                    throw ValidationException::withMessages([
                        'shipping' => 'Pengiriman belum dikonfigurasi (lokasi asal / API platform). Hubungi toko.',
                    ]);
                }
                if ($shippingEnabled) {
                    $destinationId = (int) ($payload['shipping_destination_id'] ?? 0);
                    $courier = strtolower(trim((string) ($payload['shipping_courier'] ?? '')));
                    $service = trim((string) ($payload['shipping_service'] ?? ''));
                    if ($destinationId <= 0 || $courier === '' || $service === '') {
                        throw ValidationException::withMessages([
                            'shipping' => 'Pilih destinasi dan layanan ongkir terlebih dahulu.',
                        ]);
                    }

                    $allowedCouriers = $this->normalizeCourierList($shippingCfg['couriers'] ?? null);
                    if (! in_array($courier, $allowedCouriers, true)) {
                        throw ValidationException::withMessages([
                            'shipping_courier' => 'Kurir tidak tersedia untuk toko ini.',
                        ]);
                    }

                    $weight = $this->estimateCartWeightGram($storefront, $itemsInput);
                    $options = $raja->calculateDomesticCost($storefront, $destinationId, $weight, [$courier]);
                    $match = $raja->findMatchingOption($options, $courier, $service);
                    if (! $match) {
                        $options = $raja->calculateDomesticCost($storefront, $destinationId, $weight);
                        $match = $raja->findMatchingOption($options, $courier, $service);
                    }
                    if (! $match) {
                        throw ValidationException::withMessages([
                            'shipping' => 'Layanan ongkir tidak tersedia. Hitung ulang ongkir.',
                        ]);
                    }

                    $shippingCost = (int) $match['cost'];
                    $shippingSnapshot = [
                        'destination_id' => $destinationId,
                        'destination_label' => isset($payload['shipping_destination_label'])
                            ? trim((string) $payload['shipping_destination_label'])
                            : null,
                        'courier' => $match['code'],
                        'courier_name' => $match['name'],
                        'service' => $match['service'],
                        'description' => $match['description'],
                        'etd' => $match['etd'],
                        'cost' => $shippingCost,
                        'weight_gram' => $weight,
                    ];
                }

                $order = StorefrontOrder::query()->create([
                    'company_id' => $storefront->company_id,
                    'storefront_id' => $storefront->id,
                    'contact_id' => isset($payload['contact_id']) ? (int) $payload['contact_id'] : null,
                    'number' => $number,
                    'client_uuid' => $clientUuid,
                    'status' => 'pending_payment',
                    'customer_name' => trim((string) $payload['customer_name']),
                    'customer_phone' => isset($payload['customer_phone']) ? trim((string) $payload['customer_phone']) : null,
                    'customer_email' => isset($payload['customer_email']) ? trim((string) $payload['customer_email']) : null,
                    'customer_address' => isset($payload['customer_address']) ? trim((string) $payload['customer_address']) : null,
                    'subtotal' => $subtotal,
                    'discount' => 0,
                    'tax' => 0,
                    'shipping_cost' => $shippingCost,
                    'total' => $subtotal + $shippingCost,
                    'payment_method' => 'bank_transfer',
                    'bank_snapshot' => $banks,
                    'shipping_snapshot' => $shippingSnapshot,
                    'note' => isset($payload['note']) ? trim((string) $payload['note']) : null,
                    'placed_at' => now(),
                ]);

                foreach ($lines as $line) {
                    $order->items()->create($line);
                }

                return $order->load(['items']);
            });
        } catch (UniqueConstraintViolationException) {
            $dup = StorefrontOrder::query()
                ->withoutGlobalScopes()
                ->where('company_id', $storefront->company_id)
                ->where('client_uuid', $clientUuid)
                ->first();
            if ($dup) {
                return $dup->load(['items']);
            }

            throw ValidationException::withMessages([
                'client_uuid' => 'Order sudah ada.',
            ]);
        }
    }

    /**
     * Confirm payment: lock order, create Sale (stock + GL), allocate sold_qty for allocated mode.
     */
    public function confirmOrder(StorefrontOrder $order, ?\App\Models\User $user = null): StorefrontOrder
    {
        $user ??= auth()->user();
        if (! $user) {
            throw ValidationException::withMessages([
                'user' => 'Pengguna tidak terautentikasi.',
            ]);
        }

        return DB::transaction(function () use ($order, $user) {
            $locked = StorefrontOrder::query()
                ->withoutGlobalScopes()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($locked->status, ['pending_payment', 'awaiting_confirmation'], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Order tidak bisa dikonfirmasi.',
                ]);
            }

            $locked->loadMissing(['items', 'storefront']);
            $storefront = $locked->storefront;
            if ($storefront && $storefront->stock_mode === 'allocated') {
                foreach ($locked->items as $item) {
                    $row = StorefrontProduct::query()
                        ->withoutGlobalScopes()
                        ->where('storefront_id', $locked->storefront_id)
                        ->where('product_id', $item->product_id)
                        ->lockForUpdate()
                        ->first();
                    if (! $row || $row->allocated_qty === null) {
                        continue;
                    }
                    $remaining = max(0, (int) $row->allocated_qty - (int) $row->sold_qty);
                    if ((int) $item->qty > $remaining) {
                        throw ValidationException::withMessages([
                            'stock' => 'Stok tidak cukup untuk mengonfirmasi order ('.$item->name_snapshot.').',
                        ]);
                    }
                    $row->increment('sold_qty', (int) $item->qty);
                    $row->increment('units_sold', (int) $item->qty);
                }
            } else {
                foreach ($locked->items as $item) {
                    $row = StorefrontProduct::query()
                        ->withoutGlobalScopes()
                        ->where('storefront_id', $locked->storefront_id)
                        ->where('product_id', $item->product_id)
                        ->lockForUpdate()
                        ->first();
                    if ($row) {
                        $row->increment('units_sold', (int) $item->qty);
                    }
                }
            }

            $sale = app(SaleService::class)->createFromStorefrontOrder($locked, $user);

            $locked->update([
                'status' => 'paid',
                'paid_at' => now(),
                'sale_id' => $sale->id,
            ]);

            return $locked->fresh(['items.product:id,name,sku', 'sale:id,number']);
        });
    }

    public function markOrderShipped(StorefrontOrder $order): StorefrontOrder
    {
        return DB::transaction(function () use ($order) {
            $locked = StorefrontOrder::query()
                ->withoutGlobalScopes()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->status !== 'paid') {
                throw ValidationException::withMessages([
                    'status' => 'Hanya order berstatus dibayar yang bisa dikirim.',
                ]);
            }

            $locked->update([
                'status' => 'shipped',
                'shipped_at' => now(),
            ]);

            return $locked->fresh(['items.product:id,name,sku', 'sale:id,number']);
        });
    }

    public function markOrderDelivered(StorefrontOrder $order): StorefrontOrder
    {
        return DB::transaction(function () use ($order) {
            $locked = StorefrontOrder::query()
                ->withoutGlobalScopes()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($locked->status, ['paid', 'shipped'], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Order belum siap ditandai diterima.',
                ]);
            }

            $locked->update([
                'status' => 'delivered',
                'shipped_at' => $locked->shipped_at ?? now(),
                'delivered_at' => now(),
            ]);

            return $locked->fresh(['items.product:id,name,sku', 'sale:id,number']);
        });
    }

    /**
     * Customer review — only after order is delivered, one review per product per order.
     *
     * @param  array{rating: int, comment?: string|null, product_id: int}  $data
     */
    public function submitProductReview(
        Storefront $storefront,
        StorefrontOrder $order,
        \App\Models\StorefrontCustomer $customer,
        array $data,
    ): \App\Models\StorefrontProductReview {
        if ((int) $order->storefront_id !== (int) $storefront->id) {
            throw ValidationException::withMessages(['order' => 'Order tidak valid.']);
        }
        if ($order->status !== 'delivered') {
            throw ValidationException::withMessages([
                'order' => 'Ulasan hanya bisa dikirim setelah barang diterima.',
            ]);
        }
        if (! $customer->contact_id || (int) $order->contact_id !== (int) $customer->contact_id) {
            throw ValidationException::withMessages(['order' => 'Order bukan milik akun ini.']);
        }

        $productId = (int) $data['product_id'];
        $ownsItem = $order->items()->where('product_id', $productId)->exists();
        if (! $ownsItem) {
            throw ValidationException::withMessages(['product_id' => 'Produk tidak ada di order ini.']);
        }

        $sfProduct = StorefrontProduct::query()
            ->withoutGlobalScopes()
            ->where('storefront_id', $storefront->id)
            ->where('product_id', $productId)
            ->first();
        if (! $sfProduct) {
            throw ValidationException::withMessages(['product_id' => 'Produk tidak ditemukan di toko.']);
        }

        $existing = \App\Models\StorefrontProductReview::query()
            ->withoutGlobalScopes()
            ->where('storefront_order_id', $order->id)
            ->where('product_id', $productId)
            ->first();
        if ($existing) {
            throw ValidationException::withMessages(['product_id' => 'Produk ini sudah diulas untuk order ini.']);
        }

        $review = \App\Models\StorefrontProductReview::query()->create([
            'company_id' => $storefront->company_id,
            'storefront_id' => $storefront->id,
            'storefront_product_id' => $sfProduct->id,
            'product_id' => $productId,
            'storefront_order_id' => $order->id,
            'contact_id' => $customer->contact_id,
            'customer_name' => $customer->name ?: $order->customer_name,
            'rating' => max(1, min(5, (int) $data['rating'])),
            'comment' => isset($data['comment']) ? trim((string) $data['comment']) : null,
            'is_published' => true,
        ]);

        $this->refreshProductReviewAggregates($sfProduct);

        return $review;
    }

    public function refreshProductReviewAggregates(StorefrontProduct $row): void
    {
        $stats = \App\Models\StorefrontProductReview::query()
            ->withoutGlobalScopes()
            ->where('storefront_product_id', $row->id)
            ->where('is_published', true)
            ->selectRaw('COUNT(*) as cnt, COALESCE(AVG(rating), 0) as avg_rating')
            ->first();

        $row->forceFill([
            'review_count' => (int) ($stats->cnt ?? 0),
            'avg_rating' => round((float) ($stats->avg_rating ?? 0), 2),
        ])->save();
    }

    public function cancelOrder(StorefrontOrder $order): StorefrontOrder
    {
        return DB::transaction(function () use ($order) {
            $locked = StorefrontOrder::query()
                ->withoutGlobalScopes()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($locked->status, ['paid', 'shipped', 'delivered', 'cancelled'], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Order tidak bisa dibatalkan.',
                ]);
            }

            $locked->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
            ]);

            return $locked->fresh(['items.product:id,name,sku']);
        });
    }

    /**
     * @param  mixed  $selectedOptions
     * @return array{snapshot: list<array<string, mixed>>|null, label: string|null, extra_price: int}
     */
    private function resolveOrderVariantSelections(Product $product, mixed $selectedOptions, int $index): array
    {
        $attributes = $product->relationLoaded('variantAttributes')
            ? $product->variantAttributes
            : $product->variantAttributes()->with('options')->get();

        $storefrontAttrs = $attributes->where('show_in_storefront', true)->values();
        if ($storefrontAttrs->isEmpty()) {
            return ['snapshot' => null, 'label' => null, 'extra_price' => 0];
        }

        $picked = [];
        if (is_array($selectedOptions)) {
            foreach ($selectedOptions as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $attrId = (int) ($row['attribute_id'] ?? 0);
                $optId = (int) ($row['option_id'] ?? 0);
                if ($attrId > 0 && $optId > 0) {
                    $picked[$attrId] = $optId;
                }
            }
        }

        $snapshot = [];
        $labels = [];
        $extra = 0;

        foreach ($storefrontAttrs as $attr) {
            $optionId = $picked[(int) $attr->id] ?? 0;
            if ($optionId <= 0) {
                throw ValidationException::withMessages([
                    "items.$index.selected_options" => 'Pilih '.$attr->name.' untuk '.$product->name.'.',
                ]);
            }

            $option = $attr->options
                ->first(fn (ProductVariantOption $opt) => (int) $opt->id === $optionId && $opt->is_active);

            if (! $option) {
                throw ValidationException::withMessages([
                    "items.$index.selected_options" => 'Opsi '.$attr->name.' tidak valid.',
                ]);
            }

            $extra += (int) $option->extra_price;
            $labels[] = $attr->name.': '.$option->name;
            $snapshot[] = [
                'attribute_id' => (int) $attr->id,
                'attribute' => $attr->name,
                'option_id' => (int) $option->id,
                'option' => $option->name,
                'extra_price' => (int) $option->extra_price,
                'image_url' => $option->url(),
            ];
        }

        return [
            'snapshot' => $snapshot,
            'label' => implode(', ', $labels),
            'extra_price' => $extra,
        ];
    }

    private function assertOrderStockAvailable(
        Storefront $storefront,
        StorefrontProduct $row,
        int $qty,
        int $index,
        ?int $excludeOrderId = null,
    ): void {
        $name = (string) ($row->product?->name ?? 'produk');

        if ($storefront->stock_mode === 'allocated') {
            if ($row->allocated_qty === null) {
                return;
            }
            $remaining = max(0, (int) $row->allocated_qty - (int) $row->sold_qty);
            $pending = $this->pendingAllocatedQty($storefront, (int) $row->product_id, $excludeOrderId);
            $available = max(0, $remaining - $pending);
            if ($qty > $available) {
                throw ValidationException::withMessages([
                    "items.$index" => 'Stok tidak cukup untuk '.$name.'.',
                ]);
            }

            return;
        }

        if ($storefront->stock_mode !== 'realtime') {
            return;
        }

        $product = $row->product;
        if (! $product || ! $product->track_stock) {
            return;
        }

        $company = Company::query()->withoutGlobalScopes()->find($storefront->company_id);
        if ($company && InventorySettings::allowsNegativeStock($company)) {
            return;
        }

        $warehouseId = $this->resolveStorefrontWarehouseId($storefront);
        if (! $warehouseId) {
            throw ValidationException::withMessages([
                "items.$index" => 'Gudang toko belum dikonfigurasi untuk cek stok.',
            ]);
        }

        $onHand = app(InventoryService::class)->qtyAtWarehouse($warehouseId, (int) $row->product_id);
        if ($qty > $onHand) {
            throw ValidationException::withMessages([
                "items.$index" => 'Stok tidak cukup untuk '.$name.'.',
            ]);
        }
    }

    /**
     * @param  array{name: string, email: string, password: string, phone?: string|null, address?: string|null}  $data
     * @return array{token: string, customer: array<string, mixed>}
     */
    public function registerCustomer(Storefront $storefront, array $data): array
    {
        if (! $storefront->isShop()) {
            throw ValidationException::withMessages([
                'storefront' => 'Registrasi pembeli hanya untuk toko online.',
            ]);
        }

        $email = strtolower(trim((string) $data['email']));
        $exists = \App\Models\StorefrontCustomer::query()
            ->where('storefront_id', $storefront->id)
            ->where('email', $email)
            ->exists();
        if ($exists) {
            throw ValidationException::withMessages([
                'email' => 'Email sudah terdaftar di toko ini.',
            ]);
        }

        try {
            return DB::transaction(function () use ($storefront, $data, $email) {
                $contact = $this->linkOrCreateCustomerContact($storefront, [
                    'name' => $data['name'],
                    'email' => $email,
                    'phone' => $data['phone'] ?? null,
                    'address' => $data['address'] ?? null,
                ]);

                $customer = \App\Models\StorefrontCustomer::query()->create([
                    'company_id' => $storefront->company_id,
                    'storefront_id' => $storefront->id,
                    'contact_id' => $contact->id,
                    'name' => trim((string) $data['name']),
                    'email' => $email,
                    'phone' => isset($data['phone']) ? trim((string) $data['phone']) : null,
                    'address' => isset($data['address']) ? trim((string) $data['address']) : null,
                    'password' => $data['password'],
                    'is_active' => true,
                    'last_login_at' => now(),
                ]);

                return [
                    'token' => $customer->issueToken('storefront-web', true),
                    'customer' => $customer->toPublicArray(),
                ];
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'email' => 'Email sudah terdaftar di toko ini.',
            ]);
        }
    }

    /**
     * @return array{token: string, customer: array<string, mixed>}
     */
    public function loginCustomer(Storefront $storefront, string $email, string $password, bool $remember = true): array
    {
        $customer = \App\Models\StorefrontCustomer::query()
            ->where('storefront_id', $storefront->id)
            ->where('email', strtolower(trim($email)))
            ->first();

        if (! $customer || ! $customer->is_active || ! \App\Models\StorefrontCustomer::verifyPassword($customer, $password)) {
            throw ValidationException::withMessages([
                'email' => 'Email atau password salah.',
            ]);
        }

        $customer->forceFill(['last_login_at' => now()])->save();

        return [
            'token' => $customer->issueToken('storefront-web', $remember),
            'customer' => $customer->fresh()->toPublicArray(),
        ];
    }

    /**
     * Link existing ERP contact by email without overwriting PII, or create a new contact.
     *
     * @param  array{name: string, email: string, phone?: string|null, address?: string|null}  $data
     */
    public function linkOrCreateCustomerContact(Storefront $storefront, array $data): \App\Models\Contact
    {
        $email = strtolower(trim((string) $data['email']));
        $contact = \App\Models\Contact::query()
            ->withoutGlobalScopes()
            ->where('company_id', $storefront->company_id)
            ->where('email', $email)
            ->whereIn('type', ['customer', 'both'])
            ->first();

        if ($contact) {
            // Do not mutate ERP contact from unauthenticated storefront registration.
            return $contact;
        }

        return \App\Models\Contact::query()->create([
            'company_id' => $storefront->company_id,
            'type' => 'customer',
            'name' => trim((string) $data['name']),
            'email' => $email,
            'phone' => isset($data['phone']) ? trim((string) $data['phone']) : null,
            'address' => isset($data['address']) ? trim((string) $data['address']) : null,
            'is_active' => true,
        ]);
    }

    /**
     * Update-or-create contact for authenticated profile / checkout linking.
     *
     * @param  array{name: string, email: string, phone?: string|null, address?: string|null}  $data
     */
    public function upsertCustomerContact(Storefront $storefront, array $data): \App\Models\Contact
    {
        $email = strtolower(trim((string) $data['email']));
        $contact = \App\Models\Contact::query()
            ->withoutGlobalScopes()
            ->where('company_id', $storefront->company_id)
            ->where('email', $email)
            ->whereIn('type', ['customer', 'both'])
            ->first();

        if ($contact) {
            $contact->fill([
                'name' => trim((string) $data['name']) ?: $contact->name,
                'phone' => isset($data['phone']) && trim((string) $data['phone']) !== ''
                    ? trim((string) $data['phone'])
                    : $contact->phone,
                'address' => isset($data['address']) && trim((string) $data['address']) !== ''
                    ? trim((string) $data['address'])
                    : $contact->address,
                'is_active' => true,
            ])->save();

            return $contact;
        }

        return \App\Models\Contact::query()->create([
            'company_id' => $storefront->company_id,
            'type' => 'customer',
            'name' => trim((string) $data['name']),
            'email' => $email,
            'phone' => isset($data['phone']) ? trim((string) $data['phone']) : null,
            'address' => isset($data['address']) ? trim((string) $data['address']) : null,
            'is_active' => true,
        ]);
    }

    private function nextOrderNumber(Storefront $storefront): string
    {
        // Atomic sequence — avoids count()+1 races under concurrent checkout.
        return app(DocumentSequenceService::class)->next(
            (int) $storefront->company_id,
            'storefront_order',
            'SF',
            4,
        );
    }

    public function unitPriceFor(Storefront $storefront, StorefrontProduct $row): int
    {
        if ($row->override_price !== null) {
            return (int) $row->override_price;
        }

        $product = $row->product;
        if (! $product) {
            return 0;
        }

        return $product->priceFor(
            $storefront->outlet_id ? (int) $storefront->outlet_id : null,
            $storefront->price_channel_id ? (int) $storefront->price_channel_id : null,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertPublishReady(Storefront $storefront, array $data): void
    {
        $siteKind = (string) ($data['site_kind'] ?? $storefront->site_kind);
        if ($siteKind !== 'shop') {
            return;
        }

        $banks = array_key_exists('bank_accounts', $data) ? $data['bank_accounts'] : $storefront->bank_accounts;
        $banks = is_array($banks) ? $banks : [];
        $validBanks = array_values(array_filter($banks, function ($row) {
            if (! is_array($row)) {
                return false;
            }

            return trim((string) ($row['bank_name'] ?? '')) !== ''
                && trim((string) ($row['account_name'] ?? '')) !== ''
                && trim((string) ($row['account_number'] ?? '')) !== '';
        }));
        if ($validBanks === []) {
            throw ValidationException::withMessages([
                'status' => 'Tambahkan minimal satu rekening transfer sebelum publish toko.',
            ]);
        }

        $shipping = array_key_exists('shipping', $data)
            ? (is_array($data['shipping']) ? $data['shipping'] : [])
            : (is_array($storefront->shipping) ? $storefront->shipping : []);
        if ((bool) ($shipping['enabled'] ?? false)) {
            $probe = clone $storefront;
            $probe->shipping = $this->sanitizeShippingConfig(
                $shipping,
                is_array($storefront->shipping) ? $storefront->shipping : [],
            );
            if (! app(RajaOngkirService::class)->isConfigured($probe)) {
                throw ValidationException::withMessages([
                    'status' => 'Pengiriman aktif tapi belum lengkap (lokasi asal / API platform). Matikan pengiriman atau lengkapi setup.',
                ]);
            }
        }

        $hasVisibleProduct = StorefrontProduct::query()
            ->withoutGlobalScopes()
            ->where('storefront_id', $storefront->id)
            ->where('company_id', $storefront->company_id)
            ->where('is_visible', true)
            ->whereHas('product', fn ($q) => $q->withoutGlobalScopes()->where('is_active', true))
            ->exists();
        if (! $hasVisibleProduct) {
            throw ValidationException::withMessages([
                'status' => 'Tambahkan minimal satu produk visible sebelum publish toko.',
            ]);
        }
    }

    /**
     * @param  array{
     *   kind?: string,
     *   name: string,
     *   email: string,
     *   phone?: string|null,
     *   subject?: string|null,
     *   message: string,
     *   meta?: array<string, mixed>|null,
     *   ip?: string|null,
     *   user_agent?: string|null,
     * }  $data
     */
    public function submitInquiry(Storefront $storefront, array $data): StorefrontInquiry
    {
        $kind = ($data['kind'] ?? StorefrontInquiry::KIND_CONTACT) === StorefrontInquiry::KIND_QUOTE
            ? StorefrontInquiry::KIND_QUOTE
            : StorefrontInquiry::KIND_CONTACT;

        $inquiry = StorefrontInquiry::query()->create([
            'company_id' => $storefront->company_id,
            'storefront_id' => $storefront->id,
            'kind' => $kind,
            'name' => trim((string) $data['name']),
            'email' => trim((string) $data['email']),
            'phone' => ($phone = trim((string) ($data['phone'] ?? ''))) !== '' ? $phone : null,
            'subject' => ($subject = trim((string) ($data['subject'] ?? ''))) !== '' ? $subject : null,
            'message' => trim((string) $data['message']),
            'meta' => is_array($data['meta'] ?? null) ? $data['meta'] : null,
            'status' => StorefrontInquiry::STATUS_NEW,
            'ip' => isset($data['ip']) ? substr((string) $data['ip'], 0, 45) : null,
            'user_agent' => isset($data['user_agent']) ? substr((string) $data['user_agent'], 0, 500) : null,
        ]);

        $to = trim((string) ($storefront->contact_email ?? ''));
        if ($to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) {
            try {
                Mail::to($to)->send(new StorefrontInquiryMail($storefront, $inquiry));
            } catch (\Throwable $e) {
                Log::warning('storefront_inquiry_mail_failed', [
                    'storefront_id' => $storefront->id,
                    'inquiry_id' => $inquiry->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $inquiry;
    }

    public function inquiryToArray(StorefrontInquiry $inquiry): array
    {
        return [
            'id' => $inquiry->id,
            'kind' => $inquiry->kind,
            'name' => $inquiry->name,
            'email' => $inquiry->email,
            'phone' => $inquiry->phone,
            'subject' => $inquiry->subject,
            'message' => $inquiry->message,
            'meta' => $inquiry->meta,
            'status' => $inquiry->status,
            'read_at' => optional($inquiry->read_at)?->toIso8601String(),
            'created_at' => optional($inquiry->created_at)?->toIso8601String(),
            'updated_at' => optional($inquiry->updated_at)?->toIso8601String(),
        ];
    }

    public function markInquiryRead(StorefrontInquiry $inquiry): StorefrontInquiry
    {
        if ($inquiry->status === StorefrontInquiry::STATUS_ARCHIVED) {
            return $inquiry;
        }

        $inquiry->status = StorefrontInquiry::STATUS_READ;
        $inquiry->read_at = $inquiry->read_at ?? now();
        $inquiry->save();

        return $inquiry->fresh();
    }

    public function archiveInquiry(StorefrontInquiry $inquiry): StorefrontInquiry
    {
        $inquiry->status = StorefrontInquiry::STATUS_ARCHIVED;
        if (! $inquiry->read_at) {
            $inquiry->read_at = now();
        }
        $inquiry->save();

        return $inquiry->fresh();
    }
}
