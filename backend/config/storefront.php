<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Public edge / DNS verification targets
    |--------------------------------------------------------------------------
    */

    'dns_target_host' => env('STOREFRONT_DNS_TARGET_HOST', 'sites.keaone.id'),

    'dns_target_ips' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('STOREFRONT_DNS_TARGET_IPS', '')),
    ))),

    'ssl_provider' => env('STOREFRONT_SSL_PROVIDER', 'pending'),

    /*
    |--------------------------------------------------------------------------
    | Block types (legacy page builder — templates no longer use the designer)
    |--------------------------------------------------------------------------
    */

    'block_types' => [
        ['type' => 'hero', 'label' => 'Hero', 'description' => 'Banner utama dengan judul dan CTA'],
        ['type' => 'carousel', 'label' => 'Carousel', 'description' => 'Slider promo'],
        ['type' => 'gallery', 'label' => 'Galeri', 'description' => 'Grid gambar'],
        ['type' => 'rich_text', 'label' => 'Teks', 'description' => 'Judul dan isi teks'],
        ['type' => 'product_grid', 'label' => 'Produk', 'description' => 'Grid katalog produk'],
        ['type' => 'category_split', 'label' => 'Kategori produk', 'description' => 'Pilih beberapa kategori produk; klik untuk filter katalog'],
        ['type' => 'banner', 'label' => 'Banner', 'description' => 'Banner full-bleed / shoppable'],
        ['type' => 'contact', 'label' => 'Kontak', 'description' => 'Info kontak toko'],
        ['type' => 'spacer', 'label' => 'Spacer', 'description' => 'Jarak antar section'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Templates = static layouts. Edit only via theme slots (Konten template).
    | Each slot may include: section (group label), default (shown in form/preview).
    |--------------------------------------------------------------------------
    */

    'templates' => [
        'landing' => [
            [
                'key' => 'landing_minimal',
                'name' => 'Minimal jasa',
                'kind' => 'landing',
                'description' => 'Hero, layanan, kontak — cocok untuk jasa.',
                'preset_blocks' => ['hero', 'rich_text', 'contact'],
                'slots' => [
                    ['key' => 'hero_image', 'type' => 'image', 'label' => 'Gambar banner hero', 'section' => 'Hero'],
                    ['key' => 'hero_cta', 'type' => 'text', 'label' => 'Teks tombol CTA', 'section' => 'Hero', 'default' => 'Hubungi kami'],
                    ['key' => 'footer_col1_title', 'type' => 'text', 'label' => 'Footer — judul link', 'section' => 'Footer', 'default' => 'Navigasi'],
                    ['key' => 'footer_col1_links', 'type' => 'textarea', 'label' => 'Footer — link (Label | target)', 'section' => 'Footer', 'default' => "Layanan | #layanan\nKontak | #kontak"],
                ],
            ],
            [
                'key' => 'landing_studio',
                'name' => 'Studio',
                'kind' => 'landing',
                'description' => 'Landing dengan fokus portofolio / profil usaha.',
                'preset_blocks' => ['hero', 'gallery', 'contact'],
                'slots' => [
                    ['key' => 'hero_image', 'type' => 'image', 'label' => 'Foto utama', 'section' => 'Hero'],
                    ['key' => 'hero_cta', 'type' => 'text', 'label' => 'Teks tombol CTA', 'section' => 'Hero', 'default' => 'Hubungi kami'],
                    ['key' => 'gallery', 'type' => 'gallery', 'label' => 'Galeri karya', 'section' => 'Galeri', 'max' => 4],
                    ['key' => 'footer_col1_title', 'type' => 'text', 'label' => 'Footer — judul link', 'section' => 'Footer', 'default' => 'Navigasi'],
                    ['key' => 'footer_col1_links', 'type' => 'textarea', 'label' => 'Footer — link (Label | target)', 'section' => 'Footer', 'default' => "Work | #work\nAbout | #about\nContact | #kontak"],
                ],
            ],
        ],
        'shop' => [
            [
                'key' => 'shop_nexora',
                'name' => 'Nexora market',
                'kind' => 'shop',
                'description' => 'Megastore modern: hero, promo, kategori, deals, sale, cerita merek.',
                'preset_blocks' => [],
                'slots' => [
                    // Hero
                    ['key' => 'hero_image', 'type' => 'image', 'label' => 'Gambar hero (kanan)', 'section' => '1. Hero'],
                    ['key' => 'hero_kicker_left', 'type' => 'text', 'label' => 'Label kecil di atas judul', 'section' => '1. Hero', 'default' => 'HOME TECH'],
                    ['key' => 'hero_headline', 'type' => 'text', 'label' => 'Judul besar', 'section' => '1. Hero', 'default' => 'Clean Air, Better Living'],
                    ['key' => 'hero_body', 'type' => 'textarea', 'label' => 'Teks di bawah judul', 'section' => '1. Hero', 'default' => 'Purifiers and smart essentials designed for quieter comfort and cleaner spaces.'],
                    ['key' => 'hero_cta', 'type' => 'text', 'label' => 'Teks tombol hero', 'section' => '1. Hero', 'default' => 'Shop Home Tech'],
                    // Promo pair
                    ['key' => 'promo_left_image', 'type' => 'image', 'label' => 'Gambar promo kiri', 'section' => '2. Banner promo'],
                    ['key' => 'promo_left_title', 'type' => 'text', 'label' => 'Judul promo kiri', 'section' => '2. Banner promo', 'default' => 'Catch Big Deals on Laptops'],
                    ['key' => 'promo_left_body', 'type' => 'textarea', 'label' => 'Teks promo kiri', 'section' => '2. Banner promo', 'default' => 'Save up to 20% on select notebooks today.'],
                    ['key' => 'promo_right_image', 'type' => 'image', 'label' => 'Gambar promo kanan', 'section' => '2. Banner promo'],
                    ['key' => 'promo_right_title', 'type' => 'text', 'label' => 'Judul promo kanan', 'section' => '2. Banner promo', 'default' => 'Smartwatch Essentials'],
                    ['key' => 'promo_right_body', 'type' => 'textarea', 'label' => 'Teks promo kanan', 'section' => '2. Banner promo', 'default' => 'Fitness tracking, notifications, and all-day comfort.'],
                    // Categories
                    ['key' => 'categories_title', 'type' => 'text', 'label' => 'Judul section kategori', 'section' => '3. Kategori', 'default' => 'Shop deals by category'],
                    ['key' => 'categories', 'type' => 'categories', 'label' => 'Pilih kategori (+ gambar opsional)', 'section' => '3. Kategori', 'max' => 6],
                    // Product sections
                    ['key' => 'deals_title', 'type' => 'text', 'label' => 'Judul Best Deals', 'section' => '4. Section produk', 'default' => "Today's Best Deals"],
                    ['key' => 'deals_body', 'type' => 'text', 'label' => 'Subteks Best Deals', 'section' => '4. Section produk', 'default' => 'Selected picks with special pricing today.'],
                    ['key' => 'arrivals_title', 'type' => 'text', 'label' => 'Judul New Arrivals', 'section' => '4. Section produk', 'default' => 'New Arrivals'],
                    ['key' => 'trending_title', 'type' => 'text', 'label' => 'Judul Best Sellers', 'section' => '4. Section produk', 'default' => 'Best Sellers'],
                    // Sale strip
                    ['key' => 'sale_banner_image', 'type' => 'image', 'label' => 'Gambar samping banner sale', 'section' => '5. Banner sale'],
                    ['key' => 'sale_kicker', 'type' => 'text', 'label' => 'Label kecil sale', 'section' => '5. Banner sale', 'default' => 'Limited offer'],
                    ['key' => 'sale_banner_title', 'type' => 'text', 'label' => 'Judul banner sale', 'section' => '5. Banner sale', 'default' => 'Mid-Season Sale Is Live'],
                    ['key' => 'sale_banner_body', 'type' => 'textarea', 'label' => 'Teks banner sale', 'section' => '5. Banner sale', 'default' => 'Up to 25% Off Storewide. Limited time. Exclusions apply.'],
                    ['key' => 'sale_cta', 'type' => 'text', 'label' => 'Teks tombol sale', 'section' => '5. Banner sale', 'default' => 'Shop the sale'],
                    // Brand story
                    ['key' => 'story_kicker', 'type' => 'text', 'label' => 'Label kecil cerita merek', 'section' => '6. Cerita merek', 'default' => 'Designed with care'],
                    ['key' => 'story_title', 'type' => 'text', 'label' => 'Judul cerita merek', 'section' => '6. Cerita merek', 'default' => 'Our story'],
                    ['key' => 'story_body', 'type' => 'textarea', 'label' => 'Teks cerita merek', 'section' => '6. Cerita merek', 'default' => 'Purifiers and smart essentials designed for quieter comfort and cleaner spaces.'],
                    // Footer
                    ['key' => 'footer_tagline', 'type' => 'text', 'label' => 'Tagline footer', 'section' => '7. Footer', 'default' => 'Multibrand store for everyday essentials.'],
                    ['key' => 'footer_col1_title', 'type' => 'text', 'label' => 'Footer kolom 1 — judul', 'section' => '7. Footer', 'default' => 'Quick Links'],
                    ['key' => 'footer_col1_links', 'type' => 'textarea', 'label' => 'Footer kolom 1 — link (Label | target)', 'section' => '7. Footer', 'default' => "Home | #categories\nCategories | #categories\nBest Deals | #deals\nNew Arrivals | #arrivals"],
                    ['key' => 'footer_col2_title', 'type' => 'text', 'label' => 'Footer kolom 2 — judul', 'section' => '7. Footer', 'default' => 'Help'],
                    ['key' => 'footer_col2_links', 'type' => 'textarea', 'label' => 'Footer kolom 2 — link (Label | target)', 'section' => '7. Footer', 'default' => "Cart | cart\nMy Account | account\nContact | #contact"],
                    ['key' => 'footer_legal_links', 'type' => 'textarea', 'label' => 'Link legal bawah (Label | target)', 'section' => '7. Footer', 'default' => "Privacy Policy | #\nTerms & Conditions | #"],
                ],
            ],
            [
                'key' => 'shop_editorial',
                'name' => 'Editorial lookbook',
                'kind' => 'shop',
                'description' => 'Hero full-bleed, kategori, drop produk, banner koleksi, galeri.',
                'preset_blocks' => [],
                'slots' => [
                    ['key' => 'hero_image', 'type' => 'image', 'label' => 'Gambar hero full-screen', 'section' => '1. Hero'],
                    [
                        'key' => 'nav_style',
                        'type' => 'select',
                        'label' => 'Gaya navbar',
                        'section' => '1. Hero',
                        'default' => 'overlay',
                        'options' => [
                            ['value' => 'overlay', 'label' => 'Transparan — teks putih (hero gelap)'],
                            ['value' => 'overlay_dark', 'label' => 'Transparan — teks gelap (hero terang)'],
                            ['value' => 'solid', 'label' => 'Solid putih selalu'],
                        ],
                    ],
                    ['key' => 'hero_kicker_left', 'type' => 'text', 'label' => 'Label kiri bawah hero', 'section' => '1. Hero', 'default' => 'Baru'],
                    ['key' => 'hero_kicker_right', 'type' => 'text', 'label' => 'Label kanan bawah hero', 'section' => '1. Hero', 'default' => '2026'],
                    ['key' => 'categories', 'type' => 'categories', 'label' => 'Kategori produk', 'section' => '2. Kategori', 'max' => 8],
                    ['key' => 'drop_title', 'type' => 'text', 'label' => 'Judul section produk', 'section' => '3. Produk', 'default' => 'Produk terbaru'],
                    ['key' => 'drop_body', 'type' => 'textarea', 'label' => 'Teks section produk', 'section' => '3. Produk', 'default' => 'Koleksi pilihan yang siap dikirim.'],
                    ['key' => 'collection_image', 'type' => 'image', 'label' => 'Gambar banner koleksi', 'section' => '4. Banner koleksi'],
                    ['key' => 'collection_title', 'type' => 'text', 'label' => 'Judul banner koleksi', 'section' => '4. Banner koleksi', 'default' => 'Koleksi unggulan'],
                    ['key' => 'collection_body', 'type' => 'textarea', 'label' => 'Deskripsi banner koleksi', 'section' => '4. Banner koleksi', 'default' => 'Temukan produk andalan musim ini.'],
                    ['key' => 'collection_kicker_left', 'type' => 'text', 'label' => 'Label kiri banner koleksi', 'section' => '4. Banner koleksi', 'default' => 'Unggulan'],
                    ['key' => 'collection_kicker_right', 'type' => 'text', 'label' => 'Label kanan banner koleksi', 'section' => '4. Banner koleksi', 'default' => 'Koleksi'],
                    ['key' => 'shoppable_image', 'type' => 'image', 'label' => 'Gambar banner shoppable', 'section' => '5. Banner shoppable'],
                    ['key' => 'shoppable_title', 'type' => 'text', 'label' => 'Judul banner shoppable', 'section' => '5. Banner shoppable', 'default' => 'Shop the look'],
                    ['key' => 'shoppable_body', 'type' => 'textarea', 'label' => 'Teks banner shoppable', 'section' => '5. Banner shoppable', 'default' => 'Produk yang tampil di foto.'],
                    ['key' => 'gallery', 'type' => 'gallery', 'label' => 'Gambar galeri', 'section' => '6. Galeri', 'max' => 6],
                    ['key' => 'social_body', 'type' => 'textarea', 'label' => 'Teks section galeri', 'section' => '6. Galeri', 'default' => 'Ikuti update terbaru dari toko kami.'],
                    ['key' => 'social_cta', 'type' => 'text', 'label' => 'CTA galeri', 'section' => '6. Galeri', 'default' => 'Lihat selengkapnya →'],
                    // Footer
                    ['key' => 'footer_tagline', 'type' => 'text', 'label' => 'Tagline footer', 'section' => '7. Footer', 'default' => 'Koleksi pilihan untuk gaya sehari-hari.'],
                    ['key' => 'footer_col1_title', 'type' => 'text', 'label' => 'Footer kolom 1 — judul', 'section' => '7. Footer', 'default' => 'Halaman'],
                    ['key' => 'footer_col1_links', 'type' => 'textarea', 'label' => 'Footer kolom 1 — link (Label | target)', 'section' => '7. Footer', 'default' => "Tentang | #home\nKontak | #kontak"],
                    ['key' => 'footer_col2_title', 'type' => 'text', 'label' => 'Footer kolom 2 — judul', 'section' => '7. Footer', 'default' => 'Toko'],
                    ['key' => 'footer_col2_links', 'type' => 'textarea', 'label' => 'Footer kolom 2 — link (Label | target)', 'section' => '7. Footer', 'default' => "Semua | #drop\nProduk | #drop\nCart | cart\nAkun | account"],
                    ['key' => 'footer_cta', 'type' => 'text', 'label' => 'Teks kanan bawah footer', 'section' => '7. Footer', 'default' => 'Hubungi kami'],
                    ['key' => 'footer_legal_links', 'type' => 'textarea', 'label' => 'Link legal (Label | target)', 'section' => '7. Footer', 'default' => "Privacy Policy | #\nTerms & Conditions | #"],
                ],
            ],
            [
                'key' => 'shop_hypermarket',
                'name' => 'Hypermarket',
                'kind' => 'shop',
                'description' => 'Gaya hypermarket: tile kategori, best sellers, special offer + countdown, top rated, brands, trust.',
                'preset_blocks' => [],
                'slots' => [
                    ['key' => 'categories', 'type' => 'categories', 'label' => 'Tile kategori (gambar + label)', 'section' => '1. Kategori', 'max' => 4],
                    ['key' => 'bestsellers_title', 'type' => 'text', 'label' => 'Judul Best Sellers', 'section' => '2. Best Sellers', 'default' => 'Best Sellers'],
                    ['key' => 'offer_kicker', 'type' => 'text', 'label' => 'Label special offer', 'section' => '3. Special Offer', 'default' => 'Special Offer -30%'],
                    ['key' => 'offer_title', 'type' => 'text', 'label' => 'Nama produk di offer', 'section' => '3. Special Offer', 'default' => 'Matte Black Slate Sushi Platter'],
                    ['key' => 'offer_body', 'type' => 'textarea', 'label' => 'Teks singkat offer', 'section' => '3. Special Offer', 'default' => 'Penawaran terbatas — amankan sebelum waktu habis.'],
                    ['key' => 'offer_price_old', 'type' => 'text', 'label' => 'Harga coret (teks)', 'section' => '3. Special Offer', 'default' => 'Rp 210.000'],
                    ['key' => 'offer_price_new', 'type' => 'text', 'label' => 'Harga promo (teks)', 'section' => '3. Special Offer', 'default' => 'Rp 150.000'],
                    ['key' => 'offer_image', 'type' => 'image', 'label' => 'Gambar special offer', 'section' => '3. Special Offer'],
                    ['key' => 'offer_deadline', 'type' => 'text', 'label' => 'Deadline countdown (YYYY-MM-DD, opsional)', 'section' => '3. Special Offer'],
                    ['key' => 'offer_cta', 'type' => 'text', 'label' => 'Teks tombol offer', 'section' => '3. Special Offer', 'default' => 'Shop now'],
                    ['key' => 'toprated_title', 'type' => 'text', 'label' => 'Judul Top Rated', 'section' => '4. Top Rated', 'default' => 'Top Rated'],
                    ['key' => 'brands_title', 'type' => 'text', 'label' => 'Judul More brands', 'section' => '5. Brands', 'default' => 'More brands'],
                    ['key' => 'brands_body', 'type' => 'textarea', 'label' => 'Teks brands (satu baris = satu kartu)', 'section' => '5. Brands', 'default' => "Craft essentials for every room.\nThoughtful tools for daily rituals.\nQuiet design, lasting materials."],
                    ['key' => 'trust_shipping_title', 'type' => 'text', 'label' => 'Trust 1 — judul', 'section' => '6. Trust badges', 'default' => 'Free World-Wide Shipping'],
                    ['key' => 'trust_shipping_body', 'type' => 'text', 'label' => 'Trust 1 — teks', 'section' => '6. Trust badges', 'default' => 'Free shipping on all orders over Rp 100.000'],
                    ['key' => 'trust_money_title', 'type' => 'text', 'label' => 'Trust 2 — judul', 'section' => '6. Trust badges', 'default' => 'Money Back Guarantee'],
                    ['key' => 'trust_money_body', 'type' => 'text', 'label' => 'Trust 2 — teks', 'section' => '6. Trust badges', 'default' => 'We return money within 30 days'],
                    ['key' => 'trust_support_title', 'type' => 'text', 'label' => 'Trust 3 — judul', 'section' => '6. Trust badges', 'default' => '24/7 Online Support'],
                    ['key' => 'trust_support_body', 'type' => 'text', 'label' => 'Trust 3 — teks', 'section' => '6. Trust badges', 'default' => 'Friendly 24/7 customer support'],
                    ['key' => 'trust_secure_title', 'type' => 'text', 'label' => 'Trust 4 — judul', 'section' => '6. Trust badges', 'default' => 'Secure Online Payments'],
                    ['key' => 'trust_secure_body', 'type' => 'text', 'label' => 'Trust 4 — teks', 'section' => '6. Trust badges', 'default' => 'SSL / Secure Certificate'],
                    ['key' => 'footer_tagline', 'type' => 'text', 'label' => 'Tagline footer', 'section' => '7. Footer', 'default' => 'Everyday goods for kitchen, work, and play.'],
                    ['key' => 'support_phone', 'type' => 'text', 'label' => 'Nomor support (footer)', 'section' => '7. Footer', 'default' => 'Need support? Call us'],
                    ['key' => 'footer_col1_title', 'type' => 'text', 'label' => 'Footer kolom link — judul', 'section' => '7. Footer', 'default' => 'Quick Links'],
                    ['key' => 'footer_col1_links', 'type' => 'textarea', 'label' => 'Footer link (Label | target)', 'section' => '7. Footer', 'default' => "Home | #categories\nBest Sellers | #bestsellers\nTop Rated | #toprated\nCart | cart\nMy Account | account"],
                    ['key' => 'footer_legal_links', 'type' => 'textarea', 'label' => 'Link legal (Label | target)', 'section' => '7. Footer', 'default' => "Privacy Policy | #\nTerms of Use | #"],
                ],
            ],
            [
                'key' => 'shop_capsule',
                'name' => 'Capsule',
                'kind' => 'shop',
                'description' => 'Fashion minimal: hero full-bleed, latest drop, campaign, kategori, bestsellers, promo, review, stories.',
                'preset_blocks' => [],
                'slots' => [
                    // 1. Hero
                    ['key' => 'hero_slides', 'type' => 'carousel', 'label' => 'Slide hero (gambar + judul)', 'section' => '1. Hero', 'max' => 3],
                    ['key' => 'hero_headline', 'type' => 'text', 'label' => 'Judul hero (jika slide kosong)', 'section' => '1. Hero', 'default' => 'Your Choice: Minimal by Design, Strong by Nature'],
                    ['key' => 'hero_image', 'type' => 'image', 'label' => 'Gambar hero (jika slide kosong)', 'section' => '1. Hero'],
                    ['key' => 'hero_cta', 'type' => 'text', 'label' => 'CTA utama', 'section' => '1. Hero', 'default' => 'Shop Collection'],
                    ['key' => 'hero_cta_secondary', 'type' => 'text', 'label' => 'CTA sekunder', 'section' => '1. Hero', 'default' => 'View All items'],
                    // 2. Latest Drop
                    ['key' => 'drop_title', 'type' => 'text', 'label' => 'Judul Latest Drop', 'section' => '2. Latest Drop', 'default' => 'Latest Drop'],
                    // 3. Campaign
                    ['key' => 'campaign_kicker', 'type' => 'text', 'label' => 'Label musim (mis. FW’25)', 'section' => '3. Campaign', 'default' => "FW’25"],
                    ['key' => 'campaign_title', 'type' => 'text', 'label' => 'Judul campaign', 'section' => '3. Campaign', 'default' => 'Built on Better, Stronger Basics'],
                    ['key' => 'campaign_body', 'type' => 'textarea', 'label' => 'Teks campaign', 'section' => '3. Campaign', 'default' => 'Core pieces upgraded with stronger materials and refined tailoring. Made to perform consistently across seasons.'],
                    ['key' => 'campaign_image', 'type' => 'image', 'label' => 'Gambar campaign', 'section' => '3. Campaign'],
                    ['key' => 'campaign_cta', 'type' => 'text', 'label' => 'CTA campaign', 'section' => '3. Campaign', 'default' => 'Shop Collection'],
                    // 4. Categories
                    ['key' => 'categories', 'type' => 'categories', 'label' => 'Kategori (Tops / Bottoms / Accessories)', 'section' => '4. Kategori', 'max' => 3],
                    ['key' => 'category_bodies', 'type' => 'textarea', 'label' => 'Deskripsi kategori (1 baris = 1 kategori)', 'section' => '4. Kategori', 'default' => "A clean, everyday piece with a comfortable fit and simple finish.\nA well-structured staple with a consistent fit and practical design.\nA practical selection of caps, bags, and footwear for everyday use."],
                    // 5. Bestsellers
                    ['key' => 'bestsellers_title', 'type' => 'text', 'label' => 'Judul Bestsellers', 'section' => '5. Bestsellers', 'default' => 'Bestsellers'],
                    ['key' => 'bestsellers_body', 'type' => 'textarea', 'label' => 'Subteks Bestsellers', 'section' => '5. Bestsellers', 'default' => 'The most purchased styles across categories, chosen for design, function, and durability.'],
                    // 6. Promo pair
                    ['key' => 'sale_kicker', 'type' => 'text', 'label' => 'Label promo kiri', 'section' => '6. Promo', 'default' => 'Sale'],
                    ['key' => 'sale_title', 'type' => 'text', 'label' => 'Judul promo kiri', 'section' => '6. Promo', 'default' => 'Power in Motion'],
                    ['key' => 'sale_body', 'type' => 'textarea', 'label' => 'Teks promo kiri', 'section' => '6. Promo', 'default' => 'High-performance footwear built with advanced cushioning and durable construction.'],
                    ['key' => 'sale_image', 'type' => 'image', 'label' => 'Gambar promo kiri', 'section' => '6. Promo'],
                    ['key' => 'sale_cta', 'type' => 'text', 'label' => 'CTA promo kiri', 'section' => '6. Promo', 'default' => 'Explore sale'],
                    ['key' => 'newdrop_kicker', 'type' => 'text', 'label' => 'Label promo kanan', 'section' => '6. Promo', 'default' => 'New Drop'],
                    ['key' => 'newdrop_title', 'type' => 'text', 'label' => 'Judul promo kanan', 'section' => '6. Promo', 'default' => 'New Drop. New Rules.'],
                    ['key' => 'newdrop_body', 'type' => 'textarea', 'label' => 'Teks promo kanan', 'section' => '6. Promo', 'default' => 'New season pieces added to the collection, available in updated colors and fits.'],
                    ['key' => 'newdrop_image', 'type' => 'image', 'label' => 'Gambar promo kanan', 'section' => '6. Promo'],
                    ['key' => 'newdrop_cta', 'type' => 'text', 'label' => 'CTA promo kanan', 'section' => '6. Promo', 'default' => 'Explore sale'],
                    // 7. Reviews
                    ['key' => 'reviews_title', 'type' => 'text', 'label' => 'Judul review', 'section' => '7. Review pelanggan', 'default' => 'Rated by Customers'],
                    ['key' => 'reviews_body', 'type' => 'textarea', 'label' => 'Review (format: Judul | Kutipan | Nama)', 'section' => '7. Review pelanggan', 'default' => "Great Fit|Fits comfortably and feels well balanced for everyday wear.|Daniel R.\nWeather Ready|Lightweight but still protective for windy or light rainy days.|Marcus L.\nSoft Warmth|Comfortable and warm without being too heavy.|Alex K.\nClean Style|Simple design that pairs easily with different outfits.|Jordan M."],
                    // 8. Stories
                    ['key' => 'stories_title', 'type' => 'text', 'label' => 'Judul stories', 'section' => '8. Stories', 'default' => 'Latest Stories'],
                    ['key' => 'stories_titles', 'type' => 'textarea', 'label' => 'Judul artikel (1 baris = 1 kartu)', 'section' => '8. Stories', 'default' => "This Is What the New Street Era Looks Like\nBuilt Different: The Rules Are Changing\nThe Standard Just Moved — And It’s Not Moving Back\nThis Isn’t a Trend Cycle. It’s a Shift in Direction."],
                    ['key' => 'gallery', 'type' => 'gallery', 'label' => 'Gambar stories (opsional)', 'section' => '8. Stories', 'max' => 4],
                    // 9. Trust + footer
                    ['key' => 'trust_1', 'type' => 'text', 'label' => 'Trust 1', 'section' => '9. Trust & Footer', 'default' => 'Secure Checkout & Buyer Protection'],
                    ['key' => 'trust_2', 'type' => 'text', 'label' => 'Trust 2', 'section' => '9. Trust & Footer', 'default' => 'Free Express Shipping Over Rp 250.000'],
                    ['key' => 'trust_3', 'type' => 'text', 'label' => 'Trust 3', 'section' => '9. Trust & Footer', 'default' => '30-Day Hassle-Free Returns'],
                    ['key' => 'trust_4', 'type' => 'text', 'label' => 'Trust 4', 'section' => '9. Trust & Footer', 'default' => '24/7 Always-On Support'],
                    ['key' => 'footer_tagline', 'type' => 'text', 'label' => 'Tagline footer', 'section' => '9. Trust & Footer', 'default' => 'Minimal, effortless essentials.'],
                    ['key' => 'footer_col1_title', 'type' => 'text', 'label' => 'Footer kolom 1 — judul', 'section' => '9. Trust & Footer', 'default' => 'Features'],
                    ['key' => 'footer_col1_links', 'type' => 'textarea', 'label' => 'Footer kolom 1 — link (Label | target)', 'section' => '9. Trust & Footer', 'default' => "Standard Post | #drop\nOverlay Post | #drop\nStandard Product | #drop\nVariable Product | #drop\nDiscounted Product | #drop"],
                    ['key' => 'footer_col2_title', 'type' => 'text', 'label' => 'Footer kolom 2 — judul', 'section' => '9. Trust & Footer', 'default' => 'Categories'],
                    ['key' => 'footer_col2_links', 'type' => 'textarea', 'label' => 'Footer kolom 2 — link (Label | target)', 'section' => '9. Trust & Footer', 'default' => "Tops | #categories\nBottoms | #categories\nAccessories | #categories"],
                    ['key' => 'footer_col3_title', 'type' => 'text', 'label' => 'Footer kolom 3 — judul', 'section' => '9. Trust & Footer', 'default' => 'Pages'],
                    ['key' => 'footer_col3_links', 'type' => 'textarea', 'label' => 'Footer kolom 3 — link (Label | target)', 'section' => '9. Trust & Footer', 'default' => "Cart | cart\nCheckout | checkout\nMy Account | account\nBlog | #stories\nAbout | #hero\nContact | #stories"],
                    ['key' => 'footer_legal_links', 'type' => 'textarea', 'label' => 'Link legal (Label | target)', 'section' => '9. Trust & Footer', 'default' => "Privacy Policy | #\nTerms of Use | #"],
                ],
            ],
            [
                'key' => 'shop_sophia',
                'name' => 'Sophia beauty',
                'kind' => 'shop',
                'description' => 'Beauty / skincare: hero split, trust strip, kategori bulat, produk, review Google-style, konsultasi, about.',
                'preset_blocks' => [],
                'slots' => [
                    // 1. Hero
                    ['key' => 'hero_image', 'type' => 'image', 'label' => 'Gambar hero (setengah lingkaran)', 'section' => '1. Hero'],
                    ['key' => 'hero_float_1', 'type' => 'image', 'label' => 'Gambar lingkaran float 1', 'section' => '1. Hero'],
                    ['key' => 'hero_float_2', 'type' => 'image', 'label' => 'Gambar lingkaran float 2', 'section' => '1. Hero'],
                    ['key' => 'hero_float_3', 'type' => 'image', 'label' => 'Gambar lingkaran float 3', 'section' => '1. Hero'],
                    ['key' => 'hero_kicker', 'type' => 'text', 'label' => 'Label rating di atas judul', 'section' => '1. Hero', 'default' => '102+ five star ratings'],
                    ['key' => 'hero_headline', 'type' => 'text', 'label' => 'Judul besar', 'section' => '1. Hero', 'default' => 'Your Trusted Choice for Quality Products in Sydney'],
                    ['key' => 'hero_body', 'type' => 'textarea', 'label' => 'Teks di bawah judul', 'section' => '1. Hero', 'default' => 'Professional services tailored to each client’s unique requirements, delivering exceptional results.'],
                    ['key' => 'hero_cta', 'type' => 'text', 'label' => 'CTA utama', 'section' => '1. Hero', 'default' => 'Request a Free Consultation'],
                    ['key' => 'hero_cta_secondary', 'type' => 'text', 'label' => 'CTA sekunder', 'section' => '1. Hero', 'default' => 'Book Online'],
                    // 2. Trust strip
                    ['key' => 'trust_1_title', 'type' => 'text', 'label' => 'Trust 1 — judul', 'section' => '2. Trust strip', 'default' => 'Returns & Exchange'],
                    ['key' => 'trust_1_body', 'type' => 'text', 'label' => 'Trust 1 — teks', 'section' => '2. Trust strip', 'default' => 'Hassle free 15 day returns'],
                    ['key' => 'trust_2_title', 'type' => 'text', 'label' => 'Trust 2 — judul', 'section' => '2. Trust strip', 'default' => 'Free Fast Shipping'],
                    ['key' => 'trust_2_body', 'type' => 'text', 'label' => 'Trust 2 — teks', 'section' => '2. Trust strip', 'default' => 'For orders above Rp 100.000'],
                    ['key' => 'trust_3_title', 'type' => 'text', 'label' => 'Trust 3 — judul', 'section' => '2. Trust strip', 'default' => 'Quality Products'],
                    ['key' => 'trust_3_body', 'type' => 'text', 'label' => 'Trust 3 — teks', 'section' => '2. Trust strip', 'default' => 'Premium skincare brands'],
                    ['key' => 'trust_4_title', 'type' => 'text', 'label' => 'Trust 4 — judul', 'section' => '2. Trust strip', 'default' => 'Secure Payments'],
                    ['key' => 'trust_4_body', 'type' => 'text', 'label' => 'Trust 4 — teks', 'section' => '2. Trust strip', 'default' => 'Trusted payment platforms'],
                    // 3. Categories
                    ['key' => 'categories_title', 'type' => 'text', 'label' => 'Judul section kategori', 'section' => '3. Kategori', 'default' => 'Explore our Product Category'],
                    ['key' => 'categories_body', 'type' => 'textarea', 'label' => 'Subteks kategori', 'section' => '3. Kategori', 'default' => 'Complete your beauty routine with sun and body care.'],
                    ['key' => 'categories', 'type' => 'categories', 'label' => 'Kategori (gambar bulat + label)', 'section' => '3. Kategori', 'max' => 5],
                    // 4. Products
                    ['key' => 'products_title', 'type' => 'text', 'label' => 'Judul section produk', 'section' => '4. Produk populer', 'default' => 'Popular Skin Products for your Daily Use'],
                    ['key' => 'products_body', 'type' => 'textarea', 'label' => 'Subteks produk', 'section' => '4. Produk populer', 'default' => 'Our picks for your skin: the products we love and recommend for a glowing you'],
                    // 5. Reviews
                    ['key' => 'reviews_title', 'type' => 'text', 'label' => 'Judul review', 'section' => '5. Review pelanggan', 'default' => 'Hear what our satisfied clients have to say about their experience.'],
                    ['key' => 'reviews_body', 'type' => 'textarea', 'label' => 'Subteks review', 'section' => '5. Review pelanggan', 'default' => 'Read honest reviews that reflect our dedication to client satisfaction and care.'],
                    ['key' => 'reviews_score', 'type' => 'text', 'label' => 'Skor (mis. 5.0)', 'section' => '5. Review pelanggan', 'default' => '5.0'],
                    ['key' => 'reviews_meta', 'type' => 'text', 'label' => 'Meta skor (mis. Based on 104 reviews)', 'section' => '5. Review pelanggan', 'default' => 'Based on 104 Google Reviews'],
                    ['key' => 'reviews_list', 'type' => 'textarea', 'label' => 'Review (format: Bintang|Kutipan|Nama)', 'section' => '5. Review pelanggan', 'default' => "5|I highly recommend to anyone considering laser treatments. Their professional staff, modern equipment, and personalized care truly set them apart.|Joshua M\n5|They truly care about their clients and deliver outstanding results. I am very happy with the service received.|Emily Collins\n5|Based on the test they truly care about their clients and deliver outstanding results. I am very happy with the service received.|Chrisa Laster\n3|I had a good experience and am very happy with the service received. Looking forward to continuing.|Joshua Mullins"],
                    // 6. Consultation CTA
                    ['key' => 'consult_image', 'type' => 'image', 'label' => 'Gambar konsultasi', 'section' => '6. Konsultasi'],
                    ['key' => 'consult_title', 'type' => 'text', 'label' => 'Judul konsultasi', 'section' => '6. Konsultasi', 'default' => 'Complimentary Consultations'],
                    ['key' => 'consult_body', 'type' => 'textarea', 'label' => 'Teks konsultasi', 'section' => '6. Konsultasi', 'default' => "Discover your ideal treatment plan with a free, personalized consultation.\n\nWe will guide you through our tailored services, designed to address your specific goals. Experience a boost in confidence and achieve the results you desire."],
                    ['key' => 'consult_cta', 'type' => 'text', 'label' => 'CTA konsultasi', 'section' => '6. Konsultasi', 'default' => 'Book Free Consultation'],
                    // 7. About
                    ['key' => 'about_image', 'type' => 'image', 'label' => 'Gambar about', 'section' => '7. About'],
                    ['key' => 'about_title', 'type' => 'text', 'label' => 'Judul about', 'section' => '7. About', 'default' => 'Providing Comprehensive Beauty Services'],
                    ['key' => 'about_subtitle', 'type' => 'text', 'label' => 'Subjudul about', 'section' => '7. About', 'default' => 'Complete skincare care. From consultation to lasting results.'],
                    ['key' => 'about_body', 'type' => 'textarea', 'label' => 'Teks about', 'section' => '7. About', 'default' => "Elevate your routine with our premier services, meticulously designed to enhance and nourish your skin. Our certified specialists leverage proven techniques to deliver personalized solutions for glow, calm, and lasting confidence.\n\nFrom strategic consultations and skin analysis to treatment plans and aftercare tracking, our comprehensive services are engineered for long-term, measurable outcomes."],
                    ['key' => 'about_cta', 'type' => 'text', 'label' => 'CTA about', 'section' => '7. About', 'default' => 'Book Online'],
                    ['key' => 'about_promo', 'type' => 'text', 'label' => 'Promo singkat (opsional)', 'section' => '7. About', 'default' => 'Use code “SOPHIE10” for 10% off your first booking. Open 7 days a week.'],
                    // 8. Footer
                    ['key' => 'footer_tagline', 'type' => 'text', 'label' => 'Tagline footer', 'section' => '8. Footer', 'default' => 'Quality beauty products and care you can trust.'],
                    ['key' => 'footer_col1_title', 'type' => 'text', 'label' => 'Footer kolom 1 — judul', 'section' => '8. Footer', 'default' => 'Quick Links'],
                    ['key' => 'footer_col1_links', 'type' => 'textarea', 'label' => 'Footer kolom 1 — link (Label | target)', 'section' => '8. Footer', 'default' => "Home | #hero\nShop | #categories\nProducts | #products\nReviews | #reviews\nBook | #consult\nAbout | #about"],
                    ['key' => 'footer_col2_title', 'type' => 'text', 'label' => 'Footer kolom 2 — judul', 'section' => '8. Footer', 'default' => 'Services'],
                    ['key' => 'footer_col2_links', 'type' => 'textarea', 'label' => 'Footer kolom 2 — link (Label | target)', 'section' => '8. Footer', 'default' => "Skin Analysis | #consult\nFacial Treatments | #consult\nBody Care | #consult\nSun Protection | #consult\nConsultation | #consult\nAftercare Support | #consult"],
                    ['key' => 'footer_col3_title', 'type' => 'text', 'label' => 'Footer kolom 3 — judul', 'section' => '8. Footer', 'default' => 'Shop'],
                    ['key' => 'footer_col3_links', 'type' => 'textarea', 'label' => 'Footer kolom 3 — link (Label | target)', 'section' => '8. Footer', 'default' => "Cart | cart\nMy Account | account\nProducts | #products\nCategories | #categories"],
                    ['key' => 'footer_legal_links', 'type' => 'textarea', 'label' => 'Link legal (Label | target)', 'section' => '8. Footer', 'default' => "Privacy Policy | #about\nTerms & Conditions | #about"],
                ],
            ],
            [
                'key' => 'shop_mizu',
                'name' => 'Mizu luxury',
                'kind' => 'shop',
                'description' => 'Minimalist luxury fashion: hero 95vh, New In, campaign, collections, Men/Women, shop by category.',
                'preset_blocks' => [],
                'slots' => [
                    // 1. Hero slider (text sits under image — Mizu style)
                    ['key' => 'hero_slides', 'type' => 'carousel', 'label' => 'Slide hero (gambar + judul + teks)', 'section' => '1. Hero', 'max' => 3],
                    ['key' => 'hero_headline', 'type' => 'text', 'label' => 'Judul hero (jika slide kosong)', 'section' => '1. Hero', 'default' => 'A Minimalist Luxury Fashion & Beauty Theme'],
                    ['key' => 'hero_body', 'type' => 'textarea', 'label' => 'Subteks hero (jika slide kosong)', 'section' => '1. Hero', 'default' => 'Designed and crafted to inspire your customers.'],
                    ['key' => 'hero_image', 'type' => 'image', 'label' => 'Gambar hero (jika slide kosong)', 'section' => '1. Hero'],
                    // 2. New In
                    ['key' => 'newin_title', 'type' => 'text', 'label' => 'Judul New In', 'section' => '2. New In', 'default' => 'New In'],
                    ['key' => 'newin_cta', 'type' => 'text', 'label' => 'CTA New In', 'section' => '2. New In', 'default' => 'Shop all'],
                    // 3. Campaign / FW collection
                    ['key' => 'campaign_image', 'type' => 'image', 'label' => 'Gambar campaign full-bleed', 'section' => '3. Campaign'],
                    ['key' => 'campaign_kicker', 'type' => 'text', 'label' => 'Label campaign (mis. FW’25 COLLECTION)', 'section' => '3. Campaign', 'default' => "FW’25 COLLECTION"],
                    ['key' => 'campaign_title', 'type' => 'text', 'label' => 'Judul campaign', 'section' => '3. Campaign', 'default' => 'Elegant and Timeless.'],
                    ['key' => 'campaign_cta', 'type' => 'text', 'label' => 'CTA campaign', 'section' => '3. Campaign', 'default' => 'Discover more'],
                    // 4. Featured collections (3 tiles)
                    ['key' => 'collections_title', 'type' => 'text', 'label' => 'Judul featured collections', 'section' => '4. Featured collections', 'default' => 'Featured collections'],
                    ['key' => 'collection_1_image', 'type' => 'image', 'label' => 'Koleksi 1 — gambar', 'section' => '4. Featured collections'],
                    ['key' => 'collection_1_title', 'type' => 'text', 'label' => 'Koleksi 1 — judul', 'section' => '4. Featured collections', 'default' => 'Jackets & Coats'],
                    ['key' => 'collection_2_image', 'type' => 'image', 'label' => 'Koleksi 2 — gambar', 'section' => '4. Featured collections'],
                    ['key' => 'collection_2_title', 'type' => 'text', 'label' => 'Koleksi 2 — judul', 'section' => '4. Featured collections', 'default' => 'Dresses'],
                    ['key' => 'collection_3_image', 'type' => 'image', 'label' => 'Koleksi 3 — gambar', 'section' => '4. Featured collections'],
                    ['key' => 'collection_3_title', 'type' => 'text', 'label' => 'Koleksi 3 — judul', 'section' => '4. Featured collections', 'default' => 'Accessories'],
                    // 5. Explore & discover
                    ['key' => 'explore_title', 'type' => 'text', 'label' => 'Judul Explore', 'section' => '5. Explore & discover', 'default' => 'Explore and Discover'],
                    ['key' => 'explore_body', 'type' => 'textarea', 'label' => 'Teks Explore', 'section' => '5. Explore & discover', 'default' => 'Mizu’s flexible and versatile design allows it to be adapted for many different types of ecommerce websites and stores.'],
                    ['key' => 'explore_cta', 'type' => 'text', 'label' => 'CTA Explore', 'section' => '5. Explore & discover', 'default' => 'Learn more'],
                    // 6. Men / Women split
                    ['key' => 'men_image', 'type' => 'image', 'label' => 'Gambar panel Men', 'section' => '6. Men & Women'],
                    ['key' => 'men_title', 'type' => 'text', 'label' => 'Judul panel Men', 'section' => '6. Men & Women', 'default' => 'Men'],
                    ['key' => 'men_body', 'type' => 'textarea', 'label' => 'Teks panel Men', 'section' => '6. Men & Women', 'default' => 'The Mizu men’s collection was designed to embody sophistication. Featuring beautiful silhouettes and an earthy colour palette, this season’s pieces were inspired by the autumn landscapes of Norway.'],
                    ['key' => 'men_cta', 'type' => 'text', 'label' => 'CTA Men', 'section' => '6. Men & Women', 'default' => 'Explore'],
                    ['key' => 'women_image', 'type' => 'image', 'label' => 'Gambar panel Women', 'section' => '6. Men & Women'],
                    ['key' => 'women_title', 'type' => 'text', 'label' => 'Judul panel Women', 'section' => '6. Men & Women', 'default' => 'Women'],
                    ['key' => 'women_body', 'type' => 'textarea', 'label' => 'Teks panel Women', 'section' => '6. Men & Women', 'default' => 'The Mizu women’s collection was designed to embody sophistication. Featuring beautiful silhouettes and an earthy colour palette, this season’s pieces were inspired by the autumn landscapes of Norway.'],
                    ['key' => 'women_cta', 'type' => 'text', 'label' => 'CTA Women', 'section' => '6. Men & Women', 'default' => 'Explore'],
                    // 7. Movement banner
                    ['key' => 'movement_image', 'type' => 'image', 'label' => 'Gambar banner movement', 'section' => '7. Movement banner'],
                    ['key' => 'movement_kicker', 'type' => 'text', 'label' => 'Label movement', 'section' => '7. Movement banner', 'default' => 'Join the movement'],
                    ['key' => 'movement_title', 'type' => 'text', 'label' => 'Judul movement', 'section' => '7. Movement banner', 'default' => 'Effortless, Eco-friendly Styles'],
                    // 8. Shop by category
                    ['key' => 'shopcat_title', 'type' => 'text', 'label' => 'Judul shop by category', 'section' => '8. Shop by category', 'default' => 'Shop by category'],
                    ['key' => 'shopcat_body', 'type' => 'textarea', 'label' => 'Subteks shop by category', 'section' => '8. Shop by category', 'default' => 'Discover and explore our curated collection of timeless pieces, designed to be worn with confidence.'],
                    ['key' => 'categories', 'type' => 'categories', 'label' => 'Kategori (+ gambar)', 'section' => '8. Shop by category', 'max' => 5],
                    // 9. Footer
                    ['key' => 'footer_tagline', 'type' => 'text', 'label' => 'Tagline footer / tentang merek', 'section' => '9. Footer', 'default' => 'Founded with a vision to bring understated luxury to the forefront, Mizu is dedicated to offering minimal designs that speak to both quality and style.'],
                    ['key' => 'footer_col1_title', 'type' => 'text', 'label' => 'Footer kolom 1 — judul', 'section' => '9. Footer', 'default' => 'Our company'],
                    ['key' => 'footer_col1_links', 'type' => 'textarea', 'label' => 'Footer kolom 1 — link (Label | target)', 'section' => '9. Footer', 'default' => "About us | #about\nDelivery & Shipping | #newin\nContact us | #footer\nStores | #shopcat\nSecure Payment | #footer"],
                    ['key' => 'footer_col2_title', 'type' => 'text', 'label' => 'Footer kolom 2 — judul', 'section' => '9. Footer', 'default' => 'Account'],
                    ['key' => 'footer_col2_links', 'type' => 'textarea', 'label' => 'Footer kolom 2 — link (Label | target)', 'section' => '9. Footer', 'default' => "My account | account\nCart | cart\nCheckout | checkout\nLost password | login"],
                    ['key' => 'footer_col3_title', 'type' => 'text', 'label' => 'Footer kolom 3 — judul', 'section' => '9. Footer', 'default' => 'Store Information'],
                    ['key' => 'footer_store_lines', 'type' => 'textarea', 'label' => 'Info toko (1 baris = 1 baris teks)', 'section' => '9. Footer', 'default' => "Mizu Theme – Minimalist Luxury Fashion\n1 Example Road\nAAAA 111\nUnited Kingdom"],
                    ['key' => 'footer_legal_links', 'type' => 'textarea', 'label' => 'Link legal (Label | target)', 'section' => '9. Footer', 'default' => "Terms and conditions of use | #\nLegal Notice | #"],
                ],
            ],
            [
                'key' => 'shop_avalon',
                'name' => 'Avalon street',
                'kind' => 'shop',
                'description' => 'Street fashion Avalon-style: announcement bar, hero sale, On Sale, New Collection, Newest Products, categories, trust, footer.',
                'preset_blocks' => [],
                'slots' => [
                    // 0. Announcement
                    ['key' => 'announce_text', 'type' => 'text', 'label' => 'Teks announcement bar', 'section' => '0. Announcement', 'default' => 'Free Delivery on orders over Rp 100.000. Don’t miss it!'],
                    // 1. Hero sale
                    ['key' => 'hero_image', 'type' => 'image', 'label' => 'Gambar hero full-bleed', 'section' => '1. Hero sale'],
                    ['key' => 'hero_kicker', 'type' => 'text', 'label' => 'Label hero (mis. Winter Sale)', 'section' => '1. Hero sale', 'default' => 'Winter Sale'],
                    ['key' => 'hero_badge', 'type' => 'text', 'label' => 'Badge diskon (mis. -40%)', 'section' => '1. Hero sale', 'default' => '-40%'],
                    ['key' => 'hero_headline', 'type' => 'text', 'label' => 'Judul hero', 'section' => '1. Hero sale', 'default' => 'Welcome to the winter fashion sale! Get ready to save on the latest looks!'],
                    ['key' => 'hero_cta', 'type' => 'text', 'label' => 'CTA hero', 'section' => '1. Hero sale', 'default' => 'Shop the Sale'],
                    // 2. On Sale
                    ['key' => 'sale_title', 'type' => 'text', 'label' => 'Judul On Sale', 'section' => '2. On Sale', 'default' => 'On Sale'],
                    ['key' => 'sale_body', 'type' => 'textarea', 'label' => 'Subteks On Sale', 'section' => '2. On Sale', 'default' => 'Our winter fashion sale is now on, with up to 40% off select styles.'],
                    // 3. New Collection banner
                    ['key' => 'collection_image', 'type' => 'image', 'label' => 'Gambar New Collection', 'section' => '3. New Collection'],
                    ['key' => 'collection_kicker', 'type' => 'text', 'label' => 'Label New Collection', 'section' => '3. New Collection', 'default' => 'New'],
                    ['key' => 'collection_title', 'type' => 'text', 'label' => 'Judul New Collection', 'section' => '3. New Collection', 'default' => 'Collection'],
                    ['key' => 'collection_cta', 'type' => 'text', 'label' => 'CTA New Collection', 'section' => '3. New Collection', 'default' => 'Shop Now'],
                    // 4. Newest Products
                    ['key' => 'newest_title', 'type' => 'text', 'label' => 'Judul Newest Products', 'section' => '4. Newest Products', 'default' => 'Newest Products'],
                    ['key' => 'newest_body', 'type' => 'textarea', 'label' => 'Subteks Newest Products', 'section' => '4. Newest Products', 'default' => 'The newest fashion products have been all about bold, daring and unique designs.'],
                    // 5. On Sale Collection banner
                    ['key' => 'sale_banner_image', 'type' => 'image', 'label' => 'Gambar On Sale Collection', 'section' => '5. On Sale Collection'],
                    ['key' => 'sale_banner_kicker', 'type' => 'text', 'label' => 'Label banner sale', 'section' => '5. On Sale Collection', 'default' => 'On Sale'],
                    ['key' => 'sale_banner_title', 'type' => 'text', 'label' => 'Judul banner sale', 'section' => '5. On Sale Collection', 'default' => 'Collection'],
                    ['key' => 'sale_banner_cta', 'type' => 'text', 'label' => 'CTA banner sale', 'section' => '5. On Sale Collection', 'default' => 'Shop the Sale'],
                    // 6. Shop by categories
                    ['key' => 'cats_title', 'type' => 'text', 'label' => 'Judul kategori', 'section' => '6. Shop by categories', 'default' => 'Shop by Categories'],
                    ['key' => 'cats_body', 'type' => 'textarea', 'label' => 'Subteks kategori', 'section' => '6. Shop by categories', 'default' => 'Browse through our categories to find the perfect look for you.'],
                    ['key' => 'categories', 'type' => 'categories', 'label' => 'Kategori (+ gambar)', 'section' => '6. Shop by categories', 'max' => 5],
                    // 7. Trust strip
                    ['key' => 'trust_1_title', 'type' => 'text', 'label' => 'Trust 1 — judul', 'section' => '7. Trust', 'default' => 'Free Shipping'],
                    ['key' => 'trust_1_body', 'type' => 'text', 'label' => 'Trust 1 — teks', 'section' => '7. Trust', 'default' => 'Free Shipping for orders over Rp 110.000'],
                    ['key' => 'trust_2_title', 'type' => 'text', 'label' => 'Trust 2 — judul', 'section' => '7. Trust', 'default' => 'Money Guarantee'],
                    ['key' => 'trust_2_body', 'type' => 'text', 'label' => 'Trust 2 — teks', 'section' => '7. Trust', 'default' => 'Within 30 days for an exchange.'],
                    ['key' => 'trust_3_title', 'type' => 'text', 'label' => 'Trust 3 — judul', 'section' => '7. Trust', 'default' => 'Online Support'],
                    ['key' => 'trust_3_body', 'type' => 'text', 'label' => 'Trust 3 — teks', 'section' => '7. Trust', 'default' => '24 hours a day, 7 days a week'],
                    ['key' => 'trust_4_title', 'type' => 'text', 'label' => 'Trust 4 — judul', 'section' => '7. Trust', 'default' => 'Flexible Payment'],
                    ['key' => 'trust_4_body', 'type' => 'text', 'label' => 'Trust 4 — teks', 'section' => '7. Trust', 'default' => 'Pay with Multiple Credit Cards'],
                    // 8. Footer
                    ['key' => 'footer_company_body', 'type' => 'textarea', 'label' => 'Teks kolom Company', 'section' => '8. Footer', 'default' => 'Find a location nearest you.'],
                    ['key' => 'footer_company_cta', 'type' => 'text', 'label' => 'CTA Company (See Our Stores)', 'section' => '8. Footer', 'default' => 'See Our Stores'],
                    ['key' => 'footer_col1_title', 'type' => 'text', 'label' => 'Footer kolom 1 — judul', 'section' => '8. Footer', 'default' => 'Information'],
                    ['key' => 'footer_col1_links', 'type' => 'textarea', 'label' => 'Footer kolom 1 — link (Label | target)', 'section' => '8. Footer', 'default' => "Shop | #newest\nMy Account | account\nCart | cart\nCheckout | checkout"],
                    ['key' => 'footer_col2_title', 'type' => 'text', 'label' => 'Footer kolom 2 — judul', 'section' => '8. Footer', 'default' => 'Services'],
                    ['key' => 'footer_col2_links', 'type' => 'textarea', 'label' => 'Footer kolom 2 — link (Label | target)', 'section' => '8. Footer', 'default' => "About Us | #collection\nCareers | #footer\nDelivery Info | #trust\nPrivacy Policy | #footer"],
                    ['key' => 'footer_col3_title', 'type' => 'text', 'label' => 'Footer kolom 3 — judul', 'section' => '8. Footer', 'default' => 'Social Media'],
                    ['key' => 'footer_col3_links', 'type' => 'textarea', 'label' => 'Footer kolom 3 — link (Label | target)', 'section' => '8. Footer', 'default' => "Twitter | #\nFacebook | #\nInstagram | #\nPinterest | #"],
                    ['key' => 'footer_legal_links', 'type' => 'textarea', 'label' => 'Link legal (Label | target)', 'section' => '8. Footer', 'default' => "Privacy Policy | #\nTerms of Use | #"],
                ],
            ],
        ],
    ],

    'defaults' => [
        'site_kind' => 'landing',
        'template_key' => 'landing_minimal',
        'status' => 'draft',
        'stock_mode' => 'realtime',
        'payment_method' => 'bank_transfer',
        'brand_colors' => [
            'primary' => '#0f766e',
            'accent' => '#f59e0b',
            'background' => '#f8fafc',
            'text' => '#0f172a',
        ],
        'theme_content' => [],
    ],

];
