<?php

namespace Tests\Unit;

use App\Support\StorefrontCatalog;
use Tests\TestCase;

class StorefrontCatalogTest extends TestCase
{
    public function test_normalize_host_strips_protocol_and_www(): void
    {
        $this->assertSame('tokoanda.com', StorefrontCatalog::normalizeHost('https://www.TokoAnda.com/path'));
    }

    public function test_valid_host(): void
    {
        $this->assertTrue(StorefrontCatalog::isValidHost('tokoanda.com'));
        $this->assertTrue(StorefrontCatalog::isValidHost('shop.tokoanda.co.id'));
        $this->assertFalse(StorefrontCatalog::isValidHost('not a domain'));
        $this->assertFalse(StorefrontCatalog::isValidHost('localhost'));
    }

    public function test_templates_by_kind(): void
    {
        $landing = StorefrontCatalog::templates('landing');
        $shop = StorefrontCatalog::templates('shop');

        $this->assertNotEmpty($landing);
        $this->assertNotEmpty($shop);
        $this->assertTrue(StorefrontCatalog::templateExists($landing[0]['key'], 'landing'));
        $this->assertFalse(StorefrontCatalog::templateExists($landing[0]['key'], 'shop'));
        $this->assertNotEmpty(StorefrontCatalog::slotsFor('shop_editorial'));
        $this->assertNotEmpty(StorefrontCatalog::slotsFor('shop_nexora'));
        $this->assertNotEmpty(StorefrontCatalog::slotsFor('shop_hypermarket'));
        $this->assertNotEmpty(StorefrontCatalog::slotsFor('shop_capsule'));
        $this->assertNotEmpty(StorefrontCatalog::slotsFor('shop_sophia'));
        $this->assertNotEmpty(StorefrontCatalog::slotsFor('shop_mizu'));
        $this->assertNotEmpty(StorefrontCatalog::slotsFor('shop_avalon'));
        $this->assertNotEmpty(StorefrontCatalog::slotsFor('landing_medidove'));
        $this->assertFalse(StorefrontCatalog::templateExists('shop_classic', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_nexora', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_hypermarket', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_capsule', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_sophia', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_mizu', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_avalon', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('landing_medidove', 'landing'));
    }

    public function test_sanitize_theme_content_keeps_known_slots(): void
    {
        $clean = StorefrontCatalog::sanitizeThemeContent('shop_nexora', [
            'hero_image' => 'storefront/demo.jpg',
            'hero_cta' => 'Shop now',
            'unknown' => 'drop me',
            'deals_title' => 'Best deals',
        ]);

        $this->assertSame('/media/storefront/demo.jpg', $clean['hero_image']);
        $this->assertSame('Shop now', $clean['hero_cta']);
        $this->assertArrayNotHasKey('unknown', $clean);
        $this->assertSame('Best deals', $clean['deals_title']);

        $hm = StorefrontCatalog::sanitizeThemeContent('shop_hypermarket', [
            'bestsellers_title' => 'Larisan',
            'offer_kicker' => 'Diskon 30%',
            'unknown' => 'x',
        ]);
        $this->assertSame('Larisan', $hm['bestsellers_title']);
        $this->assertSame('Diskon 30%', $hm['offer_kicker']);
        $this->assertArrayNotHasKey('unknown', $hm);

        $cap = StorefrontCatalog::sanitizeThemeContent('shop_capsule', [
            'drop_title' => 'Drop Baru',
            'hero_cta' => 'Shop Collection',
            'unknown' => 'x',
        ]);
        $this->assertSame('Drop Baru', $cap['drop_title']);
        $this->assertSame('Shop Collection', $cap['hero_cta']);
        $this->assertArrayNotHasKey('unknown', $cap);

        $sophia = StorefrontCatalog::sanitizeThemeContent('shop_sophia', [
            'hero_headline' => 'Trusted beauty',
            'products_title' => 'Popular Skin Products',
            'unknown' => 'x',
        ]);
        $this->assertSame('Trusted beauty', $sophia['hero_headline']);
        $this->assertSame('Popular Skin Products', $sophia['products_title']);
        $this->assertArrayNotHasKey('unknown', $sophia);

        $mizu = StorefrontCatalog::sanitizeThemeContent('shop_mizu', [
            'newin_title' => 'New In',
            'campaign_title' => 'Elegant and Timeless.',
            'unknown' => 'x',
        ]);
        $this->assertSame('New In', $mizu['newin_title']);
        $this->assertSame('Elegant and Timeless.', $mizu['campaign_title']);
        $this->assertArrayNotHasKey('unknown', $mizu);

        $avalon = StorefrontCatalog::sanitizeThemeContent('shop_avalon', [
            'hero_kicker' => 'Winter Sale',
            'sale_title' => 'On Sale',
            'unknown' => 'x',
        ]);
        $this->assertSame('Winter Sale', $avalon['hero_kicker']);
        $this->assertSame('On Sale', $avalon['sale_title']);
        $this->assertArrayNotHasKey('unknown', $avalon);

        $medidove = StorefrontCatalog::sanitizeThemeContent('landing_medidove', [
            'hero_headline' => 'Best Care & Better Doctor.',
            'dept_title' => 'Managed Your Healthcare Services',
            'unknown' => 'x',
        ]);
        $this->assertSame('Best Care & Better Doctor.', $medidove['hero_headline']);
        $this->assertSame('Managed Your Healthcare Services', $medidove['dept_title']);
        $this->assertArrayNotHasKey('unknown', $medidove);
    }

    public function test_sanitize_theme_content_select_slot(): void
    {
        $clean = StorefrontCatalog::sanitizeThemeContent('shop_editorial', [
            'nav_style' => 'solid',
            'hero_kicker_left' => 'Baru',
        ]);
        $this->assertSame('solid', $clean['nav_style']);

        $rejected = StorefrontCatalog::sanitizeThemeContent('shop_editorial', [
            'nav_style' => 'neon-pink',
        ]);
        $this->assertArrayNotHasKey('nav_style', $rejected);
    }

    public function test_check_rejects_invalid_host_shape(): void
    {
        $this->assertFalse(StorefrontCatalog::isValidHost('bukan domain'));
    }

    public function test_preset_blocks_for_templates(): void
    {
        // Static shop templates use empty preset_blocks → fallback single hero.
        $editorial = StorefrontCatalog::presetBlocksFor('shop_editorial');
        $this->assertSame(['hero'], array_column($editorial, 'type'));

        $nexora = StorefrontCatalog::presetBlocksFor('shop_nexora');
        $this->assertSame(['hero'], array_column($nexora, 'type'));

        $hyper = StorefrontCatalog::presetBlocksFor('shop_hypermarket');
        $this->assertSame(['hero'], array_column($hyper, 'type'));

        $capsule = StorefrontCatalog::presetBlocksFor('shop_capsule');
        $this->assertSame(['hero'], array_column($capsule, 'type'));

        $sophia = StorefrontCatalog::presetBlocksFor('shop_sophia');
        $this->assertSame(['hero'], array_column($sophia, 'type'));

        $mizu = StorefrontCatalog::presetBlocksFor('shop_mizu');
        $this->assertSame(['hero'], array_column($mizu, 'type'));

        $avalon = StorefrontCatalog::presetBlocksFor('shop_avalon');
        $this->assertSame(['hero'], array_column($avalon, 'type'));

        $medidove = StorefrontCatalog::presetBlocksFor('landing_medidove');
        $this->assertSame(['hero'], array_column($medidove, 'type'));

        $structura = StorefrontCatalog::presetBlocksFor('landing_structura');
        $this->assertSame(['hero'], array_column($structura, 'type'));

        $ellipse = StorefrontCatalog::presetBlocksFor('landing_ellipse');
        $this->assertSame(['hero'], array_column($ellipse, 'type'));

        $dilabs = StorefrontCatalog::presetBlocksFor('landing_dilabs');
        $this->assertSame(['hero'], array_column($dilabs, 'type'));

        $oneex = StorefrontCatalog::presetBlocksFor('landing_oneex');
        $this->assertSame(['hero'], array_column($oneex, 'type'));

        $prompt = StorefrontCatalog::presetBlocksFor('landing_prompt');
        $this->assertSame(['hero'], array_column($prompt, 'type'));

        $canun = StorefrontCatalog::presetBlocksFor('landing_canun');
        $this->assertSame(['hero'], array_column($canun, 'type'));

        $this->assertFalse(StorefrontCatalog::templateExists('shop_compact', 'shop'));
        $this->assertFalse(StorefrontCatalog::templateExists('shop_classic', 'shop'));
        $this->assertFalse(StorefrontCatalog::templateExists('landing_studio', 'landing'));
        $this->assertFalse(StorefrontCatalog::templateExists('landing_minimal', 'landing'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_nexora', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_hypermarket', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_capsule', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_sophia', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_mizu', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('shop_avalon', 'shop'));
        $this->assertTrue(StorefrontCatalog::templateExists('landing_medidove', 'landing'));
        $this->assertTrue(StorefrontCatalog::templateExists('landing_structura', 'landing'));
        $this->assertTrue(StorefrontCatalog::templateExists('landing_ellipse', 'landing'));
        $this->assertTrue(StorefrontCatalog::templateExists('landing_dilabs', 'landing'));
        $this->assertTrue(StorefrontCatalog::templateExists('landing_oneex', 'landing'));
        $this->assertTrue(StorefrontCatalog::templateExists('landing_prompt', 'landing'));
        $this->assertTrue(StorefrontCatalog::templateExists('landing_canun', 'landing'));
        $this->assertTrue(StorefrontCatalog::templateHas('landing_ellipse', 'has_news'));
        $this->assertTrue(StorefrontCatalog::templateHas('landing_medidove', 'has_news'));
        $this->assertTrue(StorefrontCatalog::templateHas('landing_dilabs', 'has_news'));
        $this->assertTrue(StorefrontCatalog::templateHas('landing_oneex', 'has_news'));
        $this->assertTrue(StorefrontCatalog::templateHas('landing_prompt', 'has_news'));
        $this->assertTrue(StorefrontCatalog::templateHas('landing_canun', 'has_news'));
        $this->assertFalse(StorefrontCatalog::templateHas('landing_structure', 'has_news'));
    }

    public function test_sanitize_blocks_keeps_known_types(): void
    {
        $clean = StorefrontCatalog::sanitizeBlocks([
            ['id' => 'a1', 'type' => 'hero', 'visible' => true, 'props' => ['headline' => 'Halo', 'image' => 'storefront/x.jpg']],
            ['type' => 'unknown', 'props' => []],
            ['type' => 'spacer', 'props' => ['size' => 'lg']],
        ]);

        $this->assertCount(2, $clean);
        $this->assertSame('hero', $clean[0]['type']);
        $this->assertSame('/media/storefront/x.jpg', $clean[0]['props']['image']);
        $this->assertSame('Halo', $clean[0]['props']['headline']);
        $this->assertSame('lg', $clean[1]['props']['size']);
    }

    public function test_theme_content_to_blocks_editorial(): void
    {
        $blocks = StorefrontCatalog::themeContentToBlocks('shop_editorial', [
            'hero_image' => '/media/storefront/h.jpg',
            'drop_title' => 'Drop',
            'gallery' => ['/media/storefront/g1.jpg'],
        ], ['title' => 'Brand', 'tagline' => 'Look']);

        $this->assertSame('hero', $blocks[0]['type']);
        $this->assertSame('/media/storefront/h.jpg', $blocks[0]['props']['image']);
        $this->assertSame('Brand', $blocks[0]['props']['headline']);
        $this->assertSame('product_grid', $blocks[2]['type']);
        $this->assertSame('Drop', $blocks[2]['props']['title']);
    }

    public function test_is_seed_home_blocks(): void
    {
        $this->assertTrue(StorefrontCatalog::isSeedHomeBlocks([
            ['type' => 'hero', 'props' => ['headline' => '', 'image' => null]],
        ]));
        $this->assertTrue(StorefrontCatalog::isSeedHomeBlocks([
            ['type' => 'hero', 'props' => ['headline' => 'Hi', 'image' => null]],
        ]));
        $this->assertFalse(StorefrontCatalog::isSeedHomeBlocks([
            ['type' => 'hero', 'props' => ['headline' => 'Hi', 'image' => '/media/storefront/a.jpg']],
        ]));
    }

    public function test_sanitize_category_items_from_ids(): void
    {
        $clean = StorefrontCatalog::sanitizeBlockProps('category_split', [
            'title' => 'Shop by',
            'items' => [
                ['category_id' => 3, 'label' => 'Wanita', 'image' => 'storefront/a.jpg'],
                ['category_id' => 3, 'label' => 'Dup'],
                ['category_id' => 7, 'label' => ''],
                ['category_id' => 0, 'label' => ''],
            ],
        ]);

        $this->assertSame('Shop by', $clean['title']);
        $this->assertCount(2, $clean['items']);
        $this->assertSame(3, $clean['items'][0]['category_id']);
        $this->assertSame('/media/storefront/a.jpg', $clean['items'][0]['image']);
        $this->assertSame(7, $clean['items'][1]['category_id']);
    }
}
