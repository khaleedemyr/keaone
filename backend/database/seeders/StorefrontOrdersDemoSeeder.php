<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Product;
use App\Models\StorefrontOrder;
use App\Models\StorefrontOrderItem;
use App\Models\StorefrontProduct;
use App\Services\StorefrontService;
use Illuminate\Database\Seeder;

class StorefrontOrdersDemoSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::query()->where('name', 'Toko Demo')->first();
        if (! $company) {
            $this->command?->warn('Toko Demo belum ada. Jalankan DemoSeeder dulu.');

            return;
        }

        $storefront = app(StorefrontService::class)->forCompany($company);
        if (! $storefront->isShop()) {
            $this->command?->warn('Storefront belum mode shop. Jalankan StorefrontShopDemoSeeder dulu.');

            return;
        }

        $products = StorefrontProduct::query()
            ->where('storefront_id', $storefront->id)
            ->where('is_visible', true)
            ->with('product')
            ->orderBy('sort_order')
            ->get()
            ->pluck('product')
            ->filter()
            ->values();

        if ($products->isEmpty()) {
            $this->command?->warn('Belum ada produk storefront. Jalankan StorefrontShopDemoSeeder dulu.');

            return;
        }

        $bankSnapshot = $storefront->bank_accounts ?: [
            [
                'bank_name' => 'BCA',
                'account_name' => 'Toko Demo',
                'account_number' => '1234567890',
            ],
        ];

        $demos = [
            [
                'number' => 'SF9001',
                'client_uuid' => 'sf-demo-order-9001',
                'status' => 'pending_payment',
                'customer_name' => 'Andi Pratama',
                'customer_phone' => '081234560001',
                'customer_email' => 'andi@demo.test',
                'customer_address' => 'Jl. Melati No. 12, Menteng, Jakarta Pusat 10310',
                'note' => 'Tolong packing rapi, kirim siang hari.',
                'hours_ago' => 2,
                'shipping' => [
                    'courier' => 'jne',
                    'courier_name' => 'JNE',
                    'service' => 'REG',
                    'description' => 'Layanan Reguler',
                    'etd' => '2-3',
                    'cost' => 18000,
                    'destination_label' => 'Jakarta Pusat',
                    'weight_gram' => 500,
                ],
                'lines' => [
                    ['sku' => 'SF-TEE-001', 'qty' => 2, 'variant' => ['Warna' => 'Hitam', 'Size' => 'L']],
                ],
            ],
            [
                'number' => 'SF9002',
                'client_uuid' => 'sf-demo-order-9002',
                'status' => 'awaiting_confirmation',
                'customer_name' => 'Siti Rahma',
                'customer_phone' => '081234560002',
                'customer_email' => 'siti@demo.test',
                'customer_address' => 'Jl. Diponegoro 45, Bandung 40115',
                'note' => 'Sudah transfer BCA, mohon dicek.',
                'hours_ago' => 6,
                'shipping' => [
                    'courier' => 'jnt',
                    'courier_name' => 'J&T Express',
                    'service' => 'EZ',
                    'description' => 'Regular Service',
                    'etd' => '1-2',
                    'cost' => 15000,
                    'destination_label' => 'Bandung',
                    'weight_gram' => 900,
                ],
                'lines' => [
                    ['sku' => 'SF-HDY-001', 'qty' => 1, 'variant' => ['Warna' => 'Maroon', 'Size' => 'M']],
                    ['sku' => 'SF-BAG-001', 'qty' => 1, 'variant' => ['Warna' => 'Natural']],
                ],
            ],
            [
                'number' => 'SF9003',
                'client_uuid' => 'sf-demo-order-9003',
                'status' => 'paid',
                'customer_name' => 'Budi Santoso',
                'customer_phone' => '081234560003',
                'customer_email' => 'budi@demo.test',
                'customer_address' => 'Jl. Pemuda 88, Surabaya 60271',
                'note' => null,
                'hours_ago' => 24,
                'shipping' => [
                    'courier' => 'sicepat',
                    'courier_name' => 'SiCepat',
                    'service' => 'REG',
                    'description' => 'Reguler',
                    'etd' => '2-3',
                    'cost' => 22000,
                    'destination_label' => 'Surabaya',
                    'weight_gram' => 1100,
                ],
                'lines' => [
                    ['sku' => 'SF-SNK-001', 'qty' => 1, 'variant' => ['Size' => '42']],
                ],
            ],
            [
                'number' => 'SF9004',
                'client_uuid' => 'sf-demo-order-9004',
                'status' => 'shipped',
                'tracking_number' => 'JNE990044001ID',
                'customer_name' => 'Dewi Lestari',
                'customer_phone' => '081234560004',
                'customer_email' => 'dewi@demo.test',
                'customer_address' => 'Jl. Gajah Mada 3, Denpasar 80112',
                'note' => 'Titip di satpam jika tidak ada orang.',
                'hours_ago' => 48,
                'shipping' => [
                    'courier' => 'jne',
                    'courier_name' => 'JNE',
                    'service' => 'YES',
                    'description' => 'Yakin Esok Sampai',
                    'etd' => '1-1',
                    'cost' => 35000,
                    'destination_label' => 'Denpasar',
                    'weight_gram' => 700,
                ],
                'lines' => [
                    ['sku' => 'SF-TEE-001', 'qty' => 1, 'variant' => ['Warna' => 'Navy', 'Size' => 'M']],
                    ['sku' => 'SF-TEE-001', 'qty' => 1, 'variant' => ['Warna' => 'Putih', 'Size' => 'S']],
                ],
            ],
            [
                'number' => 'SF9005',
                'client_uuid' => 'sf-demo-order-9005',
                'status' => 'delivered',
                'tracking_number' => 'JT9876500123',
                'customer_name' => 'Rina Wijaya',
                'customer_phone' => '081234560005',
                'customer_email' => 'rina@demo.test',
                'customer_address' => 'Komplek Permata Hijau Blok B2, Tangerang 15112',
                'note' => null,
                'hours_ago' => 96,
                'shipping' => [
                    'courier' => 'jnt',
                    'courier_name' => 'J&T Express',
                    'service' => 'EZ',
                    'description' => 'Regular Service',
                    'etd' => '1-2',
                    'cost' => 12000,
                    'destination_label' => 'Tangerang',
                    'weight_gram' => 320,
                ],
                'lines' => [
                    ['sku' => 'SF-BAG-001', 'qty' => 2, 'variant' => ['Warna' => 'Hitam']],
                ],
            ],
            [
                'number' => 'SF9006',
                'client_uuid' => 'sf-demo-order-9006',
                'status' => 'cancelled',
                'customer_name' => 'Fajar Nugroho',
                'customer_phone' => '081234560006',
                'customer_email' => 'fajar@demo.test',
                'customer_address' => 'Jl. Ahmad Yani 17, Yogyakarta 55224',
                'note' => 'Batal, salah pilih size.',
                'hours_ago' => 12,
                'shipping' => [
                    'courier' => 'jne',
                    'courier_name' => 'JNE',
                    'service' => 'REG',
                    'description' => 'Layanan Reguler',
                    'etd' => '2-3',
                    'cost' => 20000,
                    'destination_label' => 'Yogyakarta',
                    'weight_gram' => 650,
                ],
                'lines' => [
                    ['sku' => 'SF-HDY-001', 'qty' => 1, 'variant' => ['Warna' => 'Olive', 'Size' => 'XL']],
                ],
            ],
        ];

        $bySku = $products->keyBy('sku');
        $created = 0;

        foreach ($demos as $demo) {
            $lines = [];
            $subtotal = 0;

            foreach ($demo['lines'] as $line) {
                /** @var Product|null $product */
                $product = $bySku->get($line['sku']) ?? $products->first();
                if (! $product) {
                    continue;
                }

                $unitPrice = (int) $product->sell_price;
                $qty = (int) $line['qty'];
                $lineTotal = $unitPrice * $qty;
                $subtotal += $lineTotal;

                $lines[] = [
                    'company_id' => $company->id,
                    'product_id' => $product->id,
                    'name_snapshot' => $product->name,
                    'variant_snapshot' => $this->toVariantSnapshot($line['variant'] ?? null),
                    'qty' => $qty,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            }

            if ($lines === []) {
                continue;
            }

            foreach ($lines as &$lineRef) {
                $label = $this->variantLabelFromSnapshot($lineRef['variant_snapshot'] ?? null);
                if ($label) {
                    $lineRef['name_snapshot'] .= ' ('.$label.')';
                }
            }
            unset($lineRef);

            $shippingCost = (int) ($demo['shipping']['cost'] ?? 0);
            $placedAt = now()->subHours((int) $demo['hours_ago']);
            $status = $demo['status'];

            $order = StorefrontOrder::query()->updateOrCreate(
                [
                    'company_id' => $company->id,
                    'number' => $demo['number'],
                ],
                [
                    'storefront_id' => $storefront->id,
                    'client_uuid' => $demo['client_uuid'],
                    'status' => $status,
                    'customer_name' => $demo['customer_name'],
                    'customer_phone' => $demo['customer_phone'],
                    'customer_email' => $demo['customer_email'],
                    'customer_address' => $demo['customer_address'],
                    'subtotal' => $subtotal,
                    'discount' => 0,
                    'tax' => 0,
                    'shipping_cost' => $shippingCost,
                    'total' => $subtotal + $shippingCost,
                    'payment_method' => 'bank_transfer',
                    'bank_snapshot' => $bankSnapshot,
                    'shipping_snapshot' => $demo['shipping'],
                    'tracking_number' => $demo['tracking_number'] ?? null,
                    'note' => $demo['note'],
                    'placed_at' => $placedAt,
                    'paid_at' => in_array($status, ['paid', 'shipped', 'delivered'], true)
                        ? $placedAt->copy()->addHours(2)
                        : null,
                    'shipped_at' => in_array($status, ['shipped', 'delivered'], true)
                        ? $placedAt->copy()->addHours(8)
                        : null,
                    'delivered_at' => $status === 'delivered'
                        ? $placedAt->copy()->addDays(2)
                        : null,
                    'cancelled_at' => $status === 'cancelled'
                        ? $placedAt->copy()->addHours(1)
                        : null,
                    'sale_id' => null,
                ],
            );

            StorefrontOrderItem::query()
                ->where('storefront_order_id', $order->id)
                ->delete();

            foreach ($lines as $line) {
                $order->items()->create($line);
            }

            $created++;
        }

        $this->command?->info("Storefront orders demo siap: {$created} order untuk Toko Demo.");
        $this->command?->info('Buka Toko Online → Order web (login owner@demo.test).');
    }

    /**
     * @param  array<string, string>|null  $variant
     * @return list<array{attribute: string, option: string, extra_price: int}>|null
     */
    private function toVariantSnapshot(?array $variant): ?array
    {
        if (! $variant) {
            return null;
        }

        $snapshot = [];
        foreach ($variant as $attribute => $option) {
            $snapshot[] = [
                'attribute' => (string) $attribute,
                'option' => (string) $option,
                'extra_price' => 0,
            ];
        }

        return $snapshot === [] ? null : $snapshot;
    }

    /**
     * @param  list<array{attribute?: string, option?: string}>|null  $snapshot
     */
    private function variantLabelFromSnapshot(?array $snapshot): ?string
    {
        if (! $snapshot) {
            return null;
        }

        $labels = [];
        foreach ($snapshot as $row) {
            $attr = trim((string) ($row['attribute'] ?? ''));
            $opt = trim((string) ($row['option'] ?? ''));
            if ($attr !== '' && $opt !== '') {
                $labels[] = $attr.': '.$opt;
            } elseif ($opt !== '') {
                $labels[] = $opt;
            }
        }

        return $labels === [] ? null : implode(', ', $labels);
    }
}
