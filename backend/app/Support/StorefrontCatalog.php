<?php

namespace App\Support;

use Illuminate\Support\Str;

class StorefrontCatalog
{
    public const BLOCK_TYPES = [
        'hero',
        'carousel',
        'gallery',
        'rich_text',
        'product_grid',
        'category_split',
        'banner',
        'contact',
        'spacer',
    ];

    /**
     * @return list<array{key: string, name: string, kind: string, description: string, slots?: list<array<string, mixed>>, preset_blocks?: list<string>}>
     */
    public static function templates(?string $kind = null): array
    {
        $all = config('storefront.templates', []);
        if ($kind === null) {
            return array_values(array_merge($all['landing'] ?? [], $all['shop'] ?? []));
        }

        return array_values($all[$kind] ?? []);
    }

    public static function templateExists(string $key, ?string $kind = null): bool
    {
        foreach (self::templates($kind) as $template) {
            if (($template['key'] ?? null) === $key) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function template(string $key): ?array
    {
        foreach (self::templates() as $template) {
            if (($template['key'] ?? null) === $key) {
                return $template;
            }
        }

        return null;
    }

    public static function templateHas(string $templateKey, string $flag): bool
    {
        $template = self::template($templateKey);

        return (bool) ($template[$flag] ?? false);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function slotsFor(string $templateKey): array
    {
        $template = self::template($templateKey);

        return array_values($template['slots'] ?? []);
    }

    /**
     * Text/select defaults from slot config (images/galleries omitted).
     *
     * @return array<string, mixed>
     */
    public static function defaultThemeContent(string $templateKey): array
    {
        $out = [];
        foreach (self::slotsFor($templateKey) as $slot) {
            $key = (string) ($slot['key'] ?? '');
            if ($key === '') {
                continue;
            }
            $type = (string) ($slot['type'] ?? 'text');
            if (! in_array($type, ['text', 'textarea', 'select'], true)) {
                continue;
            }
            $default = $slot['default'] ?? null;
            if (is_string($default) && trim($default) !== '') {
                $out[$key] = $default;
            }
        }

        return $out;
    }

    /**
     * Merge saved theme over slot defaults (saved wins for set keys).
     *
     * @param  array<string, mixed>  $saved
     * @return array<string, mixed>
     */
    public static function mergeThemeContent(string $templateKey, array $saved): array
    {
        return array_merge(self::defaultThemeContent($templateKey), $saved);
    }

    /**
     * @return list<array{type: string, label: string, description?: string}>
     */
    public static function blockTypes(): array
    {
        $configured = config('storefront.block_types', []);
        if (is_array($configured) && $configured !== []) {
            return array_values($configured);
        }

        return array_map(
            fn (string $type) => ['type' => $type, 'label' => $type],
            self::BLOCK_TYPES,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return config('storefront.defaults', []);
    }

    public static function normalizeHost(string $host): string
    {
        $host = strtolower(trim($host));
        $host = preg_replace('#^https?://#', '', $host) ?? $host;
        $host = explode('/', $host)[0] ?? $host;
        $host = explode(':', $host)[0] ?? $host;
        $host = preg_replace('/^www\./', '', $host) ?? $host;

        return rtrim($host, '.');
    }

    public static function isValidHost(string $host): bool
    {
        if ($host === '' || str_contains($host, ' ') || str_contains($host, '/')) {
            return false;
        }

        return (bool) preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i', $host);
    }

    /**
     * @return array{cname: string, a_records: list<string>, note: string}
     */
    public static function dnsInstructions(): array
    {
        $targetHost = (string) config('storefront.dns_target_host', 'sites.keaone.id');
        $ips = config('storefront.dns_target_ips', []);

        return [
            'cname' => $targetHost,
            'a_records' => is_array($ips) ? array_values($ips) : [],
            'note' => 'Arahkan domain ke target KEA One (CNAME ke host target, atau A record ke IP yang disediakan). Setelah DNS menyebar, klik Verifikasi.',
        ];
    }

    public static function mediaUrl(?string $path): ?string
    {
        if (! is_string($path) || $path === '') {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://') || str_starts_with($path, '/media/')) {
            return $path;
        }

        $file = basename($path);
        if (! preg_match('/^[A-Za-z0-9._-]+$/', $file)) {
            return null;
        }

        return '/media/storefront/'.$file;
    }

    /**
     * @return array{id: string, type: string, visible: bool, props: array<string, mixed>}
     */
    public static function newBlock(string $type, array $props = [], ?string $id = null): array
    {
        return [
            'id' => $id ?: (string) Str::uuid(),
            'type' => $type,
            'visible' => true,
            'props' => self::defaultPropsFor($type, $props),
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    public static function defaultPropsFor(string $type, array $overrides = []): array
    {
        $defaults = match ($type) {
            'hero' => [
                'image' => null,
                'headline' => '',
                'subheadline' => '',
                'cta' => '',
                'kicker_left' => '',
                'kicker_right' => '',
                'style' => 'standard',
            ],
            'carousel' => [
                'slides' => [],
            ],
            'gallery' => [
                'images' => [],
                'title' => '',
                'body' => '',
                'cta' => '',
            ],
            'rich_text' => [
                'title' => '',
                'body' => '',
            ],
            'product_grid' => [
                'title' => '',
                'body' => '',
                'limit' => 8,
            ],
            'category_split' => [
                'title' => '',
                'items' => [],
            ],
            'banner' => [
                'image' => null,
                'title' => '',
                'body' => '',
                'kicker_left' => '',
                'kicker_right' => '',
                'style' => 'collection',
            ],
            'contact' => [],
            'spacer' => [
                'size' => 'md',
            ],
            default => [],
        };

        return array_merge($defaults, $overrides);
    }

    /**
     * Build starter blocks for a template preset (empty props; apply meta/slots separately).
     *
     * @return list<array{id: string, type: string, visible: bool, props: array<string, mixed>}>
     */
    public static function presetBlocksFor(string $templateKey): array
    {
        $template = self::template($templateKey);
        $types = is_array($template['preset_blocks'] ?? null) ? $template['preset_blocks'] : ['hero'];

        $blocks = [];
        $bannerIndex = 0;
        $gridIndex = 0;
        foreach ($types as $type) {
            $type = (string) $type;
            if (! in_array($type, self::BLOCK_TYPES, true)) {
                continue;
            }
            $props = [];
            if ($type === 'hero' && ($templateKey === 'shop_editorial' || $templateKey === 'shop_nexora')) {
                $props['style'] = $templateKey === 'shop_editorial' ? 'fullbleed' : 'deal';
            }
            if ($type === 'banner') {
                if ($templateKey === 'shop_nexora') {
                    $props['style'] = $bannerIndex === 0 ? 'promo_pair' : 'sale_strip';
                } else {
                    $props['style'] = $bannerIndex === 0 ? 'collection' : 'shoppable';
                }
                $bannerIndex++;
            }
            if ($type === 'product_grid' && $templateKey === 'shop_nexora') {
                $props['title'] = $gridIndex === 0 ? "Today's Best Deals" : 'Trending now';
                $props['limit'] = 8;
                $gridIndex++;
            }
            $blocks[] = self::newBlock($type, $props);
        }

        return $blocks !== [] ? $blocks : [self::newBlock('hero')];
    }

    /**
     * Convert legacy theme_content slots into home page blocks.
     *
     * @param  array<string, mixed>  $themeContent
     * @param  array{title?: string|null, tagline?: string|null, about?: string|null}  $meta
     * @return list<array{id: string, type: string, visible: bool, props: array<string, mixed>}>
     */
    public static function themeContentToBlocks(string $templateKey, array $themeContent, array $meta = []): array
    {
        $tc = self::sanitizeThemeContent($templateKey, $themeContent);
        $title = is_string($meta['title'] ?? null) ? $meta['title'] : '';
        $tagline = is_string($meta['tagline'] ?? null) ? $meta['tagline'] : '';
        $about = is_string($meta['about'] ?? null) ? $meta['about'] : '';

        return match ($templateKey) {
            'landing_structura' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_body'] ?? $about),
                    'cta' => $tc['hero_cta'] ?? 'Get promotions',
                ]),
                self::newBlock('gallery', [
                    'images' => $tc['portfolio_gallery'] ?? ($tc['strip_gallery'] ?? []),
                    'title' => $tc['portfolio_title'] ?? 'Portfolio',
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['services_title'] ?? 'Services',
                    'body' => $tc['services_intro'] ?? $about,
                ]),
                self::newBlock('contact'),
            ],
            'landing_ellipse' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_rotate_text'] ?? $about),
                    'cta' => $tc['about_cta_1'] ?? 'Read more',
                ]),
                self::newBlock('gallery', [
                    'images' => $tc['gallery'] ?? ($tc['about_gallery'] ?? []),
                    'title' => $tc['gallery_title'] ?? 'Gallery',
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['services_title'] ?? 'Services',
                    'body' => $tc['services_intro'] ?? $about,
                ]),
                self::newBlock('contact'),
            ],
            'landing_medidove' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_body'] ?? $about),
                    'cta' => $tc['hero_cta'] ?? 'Make Appointment',
                    'style' => 'cover',
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['about_title'] ?? 'About',
                    'body' => $tc['about_body'] ?? $about,
                ]),
                self::newBlock('category_split', [
                    'title' => $tc['dept_title'] ?? 'Departments',
                    'items' => self::themeCategoriesToItems($tc),
                ]),
                self::newBlock('contact'),
            ],
            'landing_dilabs' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_body'] ?? $about),
                    'cta' => $tc['hero_cta'] ?? 'Start a project',
                    'style' => 'cover',
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['about_title'] ?? 'About',
                    'body' => $tc['about_body'] ?? $about,
                ]),
                self::newBlock('gallery', [
                    'images' => $tc['projects_gallery'] ?? [],
                    'title' => $tc['projects_title'] ?? 'Projects',
                ]),
                self::newBlock('contact'),
            ],
            'landing_oneex' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_body'] ?? $about),
                    'cta' => $tc['hero_cta'] ?? 'Discover',
                    'style' => 'cover',
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['about_title'] ?? 'About',
                    'body' => $tc['about_body'] ?? $about,
                ]),
                self::newBlock('gallery', [
                    'images' => $tc['works_gallery'] ?? [],
                    'title' => $tc['works_title'] ?? 'Works',
                ]),
                self::newBlock('contact'),
            ],
            'landing_prompt' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_body'] ?? $about),
                    'cta' => $tc['hero_cta'] ?? 'View Demos',
                    'style' => 'cover',
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['features_title'] ?? 'Features',
                    'body' => $tc['features_body'] ?? $about,
                ]),
                self::newBlock('contact'),
            ],
            'landing_canun' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_body'] ?? $about),
                    'cta' => $tc['hero_cta'] ?? 'Contact Us Now',
                    'style' => 'cover',
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['practice_title'] ?? 'Practice Areas',
                    'body' => $tc['practice_body'] ?? $about,
                ]),
                self::newBlock('gallery', [
                    'images' => $tc['cases_gallery'] ?? ($tc['attorneys_gallery'] ?? []),
                    'title' => $tc['cases_title'] ?? 'Cases',
                ]),
                self::newBlock('contact'),
            ],
            'shop_classic' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => $tagline !== '' ? $tagline : $title,
                    'subheadline' => $about,
                    'cta' => $tc['hero_cta'] ?? '',
                ]),
                self::newBlock('carousel', [
                    'slides' => $tc['carousel'] ?? [],
                ]),
                self::newBlock('product_grid', [
                    'title' => 'Produk',
                    'limit' => 12,
                ]),
            ],
            'shop_nexora' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_body'] ?? $about),
                    'kicker_left' => $tc['hero_kicker_left'] ?? 'Deal of the Day',
                    'cta' => $tc['hero_cta'] ?? 'Shop now',
                    'style' => 'deal',
                ]),
                self::newBlock('banner', [
                    'image' => $tc['promo_left_image'] ?? null,
                    'title' => $tc['promo_left_title'] ?? '',
                    'body' => $tc['promo_left_body'] ?? '',
                    'style' => 'promo_pair',
                ]),
                self::newBlock('category_split', [
                    'title' => 'Shop by Category',
                    'items' => self::themeCategoriesToItems($tc),
                ]),
                self::newBlock('product_grid', [
                    'title' => $tc['deals_title'] ?? "Today's Best Deals",
                    'limit' => 8,
                ]),
                self::newBlock('banner', [
                    'image' => $tc['sale_banner_image'] ?? null,
                    'title' => $tc['sale_banner_title'] ?? '',
                    'body' => $tc['sale_banner_body'] ?? '',
                    'style' => 'sale_strip',
                ]),
                self::newBlock('product_grid', [
                    'title' => $tc['trending_title'] ?? 'Trending now',
                    'limit' => 8,
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['story_title'] ?? $title,
                    'body' => $tc['story_body'] ?? $about,
                ]),
                self::newBlock('contact'),
            ],
            'shop_editorial' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => $title,
                    'subheadline' => $tagline,
                    'kicker_left' => $tc['hero_kicker_left'] ?? '',
                    'kicker_right' => $tc['hero_kicker_right'] ?? '',
                    'style' => 'fullbleed',
                ]),
                self::newBlock('category_split', [
                    'title' => '',
                    'items' => self::themeCategoriesToItems($tc),
                ]),
                self::newBlock('product_grid', [
                    'title' => $tc['drop_title'] ?? 'Latest Drop',
                    'body' => $tc['drop_body'] ?? '',
                    'limit' => 8,
                ]),
                self::newBlock('banner', [
                    'image' => $tc['collection_image'] ?? null,
                    'title' => $tc['collection_title'] ?? '',
                    'body' => $tc['collection_body'] ?? '',
                    'kicker_left' => $tc['collection_kicker_left'] ?? '',
                    'kicker_right' => $tc['collection_kicker_right'] ?? '',
                    'style' => 'collection',
                ]),
                self::newBlock('banner', [
                    'image' => $tc['shoppable_image'] ?? null,
                    'title' => $tc['shoppable_title'] ?? '',
                    'body' => $tc['shoppable_body'] ?? '',
                    'style' => 'shoppable',
                ]),
                self::newBlock('gallery', [
                    'images' => $tc['gallery'] ?? [],
                    'body' => $tc['social_body'] ?? '',
                    'cta' => $tc['social_cta'] ?? '',
                ]),
            ],
            'shop_capsule' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'cta' => $tc['hero_cta'] ?? 'Shop Collection',
                    'style' => 'fullbleed',
                ]),
                self::newBlock('product_grid', [
                    'title' => $tc['drop_title'] ?? 'Latest Drop',
                    'limit' => 8,
                ]),
                self::newBlock('category_split', [
                    'title' => '',
                    'items' => self::themeCategoriesToItems($tc),
                ]),
                self::newBlock('product_grid', [
                    'title' => $tc['bestsellers_title'] ?? 'Bestsellers',
                    'limit' => 8,
                ]),
                self::newBlock('gallery', [
                    'images' => $tc['gallery'] ?? [],
                ]),
                self::newBlock('contact'),
            ],
            'shop_sophia' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_body'] ?? $about),
                    'cta' => $tc['hero_cta'] ?? 'Request a Free Consultation',
                    'style' => 'split',
                ]),
                self::newBlock('category_split', [
                    'title' => $tc['categories_title'] ?? 'Explore our Product Category',
                    'items' => self::themeCategoriesToItems($tc),
                ]),
                self::newBlock('product_grid', [
                    'title' => $tc['products_title'] ?? 'Popular Skin Products for your Daily Use',
                    'limit' => 12,
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['consult_title'] ?? 'Complimentary Consultations',
                    'body' => $tc['consult_body'] ?? '',
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['about_title'] ?? 'About',
                    'body' => $tc['about_body'] ?? $about,
                ]),
                self::newBlock('contact'),
            ],
            'shop_mizu' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['hero_body'] ?? $about),
                    'cta' => $tc['campaign_cta'] ?? 'Discover more',
                    'style' => 'cover',
                ]),
                self::newBlock('product_grid', [
                    'title' => $tc['newin_title'] ?? 'New In',
                    'limit' => 8,
                ]),
                self::newBlock('rich_text', [
                    'title' => $tc['campaign_title'] ?? 'Elegant and Timeless.',
                    'body' => $tc['explore_body'] ?? '',
                ]),
                self::newBlock('category_split', [
                    'title' => $tc['shopcat_title'] ?? 'Shop by category',
                    'items' => self::themeCategoriesToItems($tc),
                ]),
                self::newBlock('contact'),
            ],
            'shop_avalon' => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => (string) ($tc['hero_headline'] ?? ($tagline !== '' ? $tagline : $title)),
                    'subheadline' => (string) ($tc['sale_body'] ?? $about),
                    'cta' => $tc['hero_cta'] ?? 'Shop the Sale',
                    'style' => 'cover',
                ]),
                self::newBlock('product_grid', [
                    'title' => $tc['sale_title'] ?? 'On Sale',
                    'limit' => 6,
                ]),
                self::newBlock('product_grid', [
                    'title' => $tc['newest_title'] ?? 'Newest Products',
                    'limit' => 8,
                ]),
                self::newBlock('category_split', [
                    'title' => $tc['cats_title'] ?? 'Shop by Categories',
                    'items' => self::themeCategoriesToItems($tc),
                ]),
                self::newBlock('contact'),
            ],
            default => [
                self::newBlock('hero', [
                    'image' => $tc['hero_image'] ?? null,
                    'headline' => $title,
                    'subheadline' => $tagline,
                    'cta' => $tc['hero_cta'] ?? '',
                ]),
                self::newBlock('rich_text', [
                    'title' => 'Layanan',
                    'body' => $about,
                ]),
                self::newBlock('contact'),
            ],
        };
    }

    /**
     * Normalize page blocks payload.
     *
     * @param  list<mixed>|array<int, mixed>  $blocks
     * @return list<array{id: string, type: string, visible: bool, props: array<string, mixed>}>
     */
    public static function sanitizeBlocks(array $blocks): array
    {
        $out = [];
        foreach (array_values($blocks) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $type = (string) ($row['type'] ?? '');
            if (! in_array($type, self::BLOCK_TYPES, true)) {
                continue;
            }
            $id = isset($row['id']) && is_string($row['id']) && $row['id'] !== ''
                ? mb_substr($row['id'], 0, 64)
                : (string) Str::uuid();
            $visible = array_key_exists('visible', $row) ? (bool) $row['visible'] : true;
            $props = is_array($row['props'] ?? null) ? $row['props'] : [];
            $out[] = [
                'id' => $id,
                'type' => $type,
                'visible' => $visible,
                'props' => self::sanitizeBlockProps($type, $props),
            ];
            if (count($out) >= 40) {
                break;
            }
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $props
     * @return array<string, mixed>
     */
    public static function sanitizeBlockProps(string $type, array $props): array
    {
        $base = self::defaultPropsFor($type);

        return match ($type) {
            'hero' => [
                'image' => self::mediaUrl(isset($props['image']) && is_string($props['image']) ? $props['image'] : null),
                'headline' => self::clipString($props['headline'] ?? '', 200),
                'subheadline' => self::clipString($props['subheadline'] ?? '', 400),
                'cta' => self::clipString($props['cta'] ?? '', 80),
                'kicker_left' => self::clipString($props['kicker_left'] ?? '', 80),
                'kicker_right' => self::clipString($props['kicker_right'] ?? '', 80),
                'style' => in_array($props['style'] ?? '', ['standard', 'fullbleed'], true)
                    ? $props['style']
                    : ($base['style'] ?? 'standard'),
            ],
            'carousel' => [
                'slides' => self::sanitizeSlides($props['slides'] ?? [], 8),
            ],
            'gallery' => [
                'images' => self::sanitizeImages($props['images'] ?? [], 12),
                'title' => self::clipString($props['title'] ?? '', 120),
                'body' => self::clipString($props['body'] ?? '', 2000),
                'cta' => self::clipString($props['cta'] ?? '', 80),
            ],
            'rich_text' => [
                'title' => self::clipString($props['title'] ?? '', 160),
                'body' => self::clipString($props['body'] ?? '', 4000),
            ],
            'product_grid' => [
                'title' => self::clipString($props['title'] ?? '', 160),
                'body' => self::clipString($props['body'] ?? '', 2000),
                'limit' => max(1, min(24, (int) ($props['limit'] ?? 8))),
            ],
            'category_split' => [
                'title' => self::clipString($props['title'] ?? '', 120),
                'items' => self::sanitizeCategoryItems($props['items'] ?? null, $props),
            ],
            'banner' => [
                'image' => self::mediaUrl(isset($props['image']) && is_string($props['image']) ? $props['image'] : null),
                'title' => self::clipString($props['title'] ?? '', 160),
                'body' => self::clipString($props['body'] ?? '', 2000),
                'kicker_left' => self::clipString($props['kicker_left'] ?? '', 80),
                'kicker_right' => self::clipString($props['kicker_right'] ?? '', 80),
                'style' => in_array($props['style'] ?? '', ['collection', 'shoppable', 'compact'], true)
                    ? $props['style']
                    : 'collection',
            ],
            'contact' => [],
            'spacer' => [
                'size' => in_array($props['size'] ?? '', ['sm', 'md', 'lg'], true) ? $props['size'] : 'md',
            ],
            default => [],
        };
    }

    /**
     * @param  mixed  $value
     * @param  array<string, mixed>  $legacyProps
     * @return list<array{category_id: int, label: string, image: string|null}>
     */
    public static function sanitizeCategoryItems(mixed $value, array $legacyProps = []): array
    {
        $rows = is_array($value) ? $value : [];
        if ($rows === []) {
            $legacy = [];
            if (($legacyProps['left_label'] ?? '') !== '' || ($legacyProps['left_image'] ?? null)) {
                $legacy[] = [
                    'category_id' => (int) ($legacyProps['left_category_id'] ?? 0),
                    'label' => $legacyProps['left_label'] ?? '',
                    'image' => $legacyProps['left_image'] ?? null,
                ];
            }
            if (($legacyProps['right_label'] ?? '') !== '' || ($legacyProps['right_image'] ?? null)) {
                $legacy[] = [
                    'category_id' => (int) ($legacyProps['right_category_id'] ?? 0),
                    'label' => $legacyProps['right_label'] ?? '',
                    'image' => $legacyProps['right_image'] ?? null,
                ];
            }
            $rows = $legacy;
        }

        $out = [];
        $seen = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $categoryId = (int) ($row['category_id'] ?? 0);
            $label = self::clipString($row['label'] ?? '', 80);
            $image = self::mediaUrl(isset($row['image']) && is_string($row['image']) ? $row['image'] : null);
            if ($categoryId <= 0 && $label === '' && $image === null) {
                continue;
            }
            if ($categoryId > 0) {
                if (isset($seen[$categoryId])) {
                    continue;
                }
                $seen[$categoryId] = true;
            }
            $out[] = [
                'category_id' => max(0, $categoryId),
                'label' => $label,
                'image' => $image,
            ];
            if (count($out) >= 12) {
                break;
            }
        }

        return $out;
    }

    /**
     * True when blocks look like the default home seed (single hero, no media).
     *
     * @param  list<array<string, mixed>>  $blocks
     */
    public static function isSeedHomeBlocks(array $blocks): bool
    {
        if ($blocks === []) {
            return true;
        }
        if (count($blocks) !== 1) {
            return false;
        }
        $block = $blocks[0];
        if (($block['type'] ?? null) !== 'hero') {
            return false;
        }
        $props = is_array($block['props'] ?? null) ? $block['props'] : [];
        $image = $props['image'] ?? ($block['image'] ?? null);

        return $image === null || $image === '';
    }

    /**
     * Lift legacy flat block fields into props before sanitize.
     *
     * @param  list<mixed>|array<int, mixed>  $blocks
     * @return list<array<string, mixed>>
     */
    public static function normalizeLegacyBlocks(array $blocks): array
    {
        $out = [];
        foreach (array_values($blocks) as $row) {
            if (! is_array($row)) {
                continue;
            }
            if (isset($row['props']) && is_array($row['props'])) {
                $out[] = $row;
                continue;
            }
            $type = (string) ($row['type'] ?? 'hero');
            $props = $row;
            unset($props['id'], $props['type'], $props['visible'], $props['props']);
            $out[] = [
                'id' => $row['id'] ?? null,
                'type' => $type,
                'visible' => $row['visible'] ?? true,
                'props' => $props,
            ];
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>|null  $colors
     * @return array{primary: string, accent: string, background: string, text: string}|null
     */
    public static function sanitizeBrandColors(?array $colors): ?array
    {
        if ($colors === null) {
            return null;
        }
        $defaults = self::defaults()['brand_colors'] ?? [
            'primary' => '#0f766e',
            'accent' => '#f59e0b',
            'background' => '#f8fafc',
            'text' => '#0f172a',
        ];
        $out = [];
        foreach (['primary', 'accent', 'background', 'text'] as $key) {
            $value = $colors[$key] ?? $defaults[$key] ?? '#000000';
            if (! is_string($value) || ! preg_match('/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/', trim($value))) {
                $value = $defaults[$key] ?? '#000000';
            }
            $out[$key] = strtolower(trim($value));
        }

        return $out;
    }

    /**
     * Normalize theme_content payload: keep only known slots, resolve media URLs.
     *
     * @param  array<string, mixed>  $content
     * @return array<string, mixed>
     */
    public static function sanitizeThemeContent(string $templateKey, array $content): array
    {
        $slots = self::slotsFor($templateKey);
        $allowed = [];
        foreach ($slots as $slot) {
            $key = (string) ($slot['key'] ?? '');
            if ($key !== '') {
                $allowed[$key] = $slot;
            }
        }

        $out = [];
        foreach ($content as $key => $value) {
            if (! isset($allowed[$key])) {
                continue;
            }
            $slot = $allowed[$key];
            $type = (string) ($slot['type'] ?? 'text');
            $max = (int) ($slot['max'] ?? 5);

            if ($type === 'image') {
                $url = self::mediaUrl(is_string($value) ? $value : null);
                if ($url) {
                    $out[$key] = $url;
                }
                continue;
            }

            if ($type === 'text') {
                if (is_string($value) && trim($value) !== '') {
                    $out[$key] = mb_substr(trim($value), 0, 120);
                }
                continue;
            }

            if ($type === 'select') {
                $allowedValues = [];
                foreach (($slot['options'] ?? []) as $option) {
                    if (is_array($option) && isset($option['value']) && is_string($option['value'])) {
                        $allowedValues[] = $option['value'];
                    } elseif (is_string($option)) {
                        $allowedValues[] = $option;
                    }
                }
                if (is_string($value) && in_array($value, $allowedValues, true)) {
                    $out[$key] = $value;
                }
                continue;
            }

            if ($type === 'textarea') {
                if (is_string($value) && trim($value) !== '') {
                    $out[$key] = mb_substr(trim($value), 0, 2000);
                }
                continue;
            }

            if ($type === 'gallery' && is_array($value)) {
                $images = self::sanitizeImages($value, $max);
                if ($images !== []) {
                    $out[$key] = $images;
                }
                continue;
            }

            if ($type === 'carousel' && is_array($value)) {
                $slides = self::sanitizeSlides($value, $max);
                if ($slides !== []) {
                    $out[$key] = $slides;
                }
                continue;
            }

            if ($type === 'categories' && is_array($value)) {
                $items = self::sanitizeCategoryItems($value);
                if ($max > 0) {
                    $items = array_slice($items, 0, $max);
                }
                if ($items !== []) {
                    $out[$key] = $items;
                }
            }
        }

        return $out;
    }

    /**
     * Build category_split items from theme_content (new categories slot or legacy left/right).
     *
     * @param  array<string, mixed>  $tc
     * @return list<array{category_id: int, label: string, image: string|null}>
     */
    public static function themeCategoriesToItems(array $tc): array
    {
        if (isset($tc['categories']) && is_array($tc['categories']) && $tc['categories'] !== []) {
            return self::sanitizeCategoryItems($tc['categories']);
        }

        return self::sanitizeCategoryItems([], [
            'left_label' => $tc['category_left_label'] ?? '',
            'left_image' => $tc['category_left_image'] ?? null,
            'right_label' => $tc['category_right_label'] ?? '',
            'right_image' => $tc['category_right_image'] ?? null,
        ]);
    }

    /**
     * @param  mixed  $value
     * @return list<string>
     */
    private static function sanitizeImages(mixed $value, int $max): array
    {
        if (! is_array($value)) {
            return [];
        }
        $images = [];
        foreach ($value as $item) {
            $url = self::mediaUrl(is_string($item) ? $item : null);
            if ($url) {
                $images[] = $url;
            }
            if (count($images) >= $max) {
                break;
            }
        }

        return $images;
    }

    /**
     * @param  mixed  $value
     * @return list<array{image: string, title: string, subtitle: string}>
     */
    private static function sanitizeSlides(mixed $value, int $max): array
    {
        if (! is_array($value)) {
            return [];
        }
        $slides = [];
        foreach ($value as $item) {
            if (! is_array($item)) {
                continue;
            }
            $url = self::mediaUrl(isset($item['image']) && is_string($item['image']) ? $item['image'] : null);
            if (! $url) {
                continue;
            }
            $slides[] = [
                'image' => $url,
                'title' => self::clipString($item['title'] ?? '', 120),
                'subtitle' => self::clipString($item['subtitle'] ?? '', 200),
            ];
            if (count($slides) >= $max) {
                break;
            }
        }

        return $slides;
    }

    private static function clipString(mixed $value, int $max): string
    {
        if (! is_string($value)) {
            return '';
        }

        return mb_substr(trim($value), 0, $max);
    }
}
