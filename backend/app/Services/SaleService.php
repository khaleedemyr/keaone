<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PriceChannel;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use App\Support\ReceiptLayout;
use App\Support\TenantCache;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleService
{
    private ?int $forceWarehouseId = null;

    public function create(array $payload, User $user): Sale
    {
        $existing = Sale::query()->where('client_uuid', $payload['client_uuid'])->first();

        if ($existing) {
            $this->assertIdempotentPayload($existing, $payload);

            return $this->loadSale($existing);
        }

        try {
            $sale = DB::transaction(function () use ($payload, $user) {
                return $this->createFresh($payload, $user);
            });
            $this->bumpSalesReportCache((int) $sale->company_id);

            return $sale;
        } catch (UniqueConstraintViolationException) {
            $sale = Sale::query()->where('client_uuid', $payload['client_uuid'])->first();

            if ($sale) {
                $this->assertIdempotentPayload($sale, $payload);

                return $this->loadSale($sale);
            }

            throw ValidationException::withMessages([
                'client_uuid' => ['Transaksi sudah ada.'],
            ]);
        }
    }

    /**
     * Convert a paid storefront order into a Sale (stock + GL) using order line prices.
     * Merchandise total only; ongkir tetap di storefront order (dicatat di note).
     */
    public function createFromStorefrontOrder(\App\Models\StorefrontOrder $order, User $user): Sale
    {
        $order->loadMissing(['items', 'storefront.priceChannel']);

        if ($order->sale_id) {
            return $this->loadSale(Sale::query()->findOrFail($order->sale_id));
        }

        $storefront = $order->storefront;
        if (! $storefront) {
            throw ValidationException::withMessages([
                'storefront' => ['Toko online tidak ditemukan.'],
            ]);
        }

        $outletId = $storefront->outlet_id
            ? (int) $storefront->outlet_id
            : (int) (CurrentCompany::outlet()?->id ?? 0);
        if ($outletId < 1) {
            throw ValidationException::withMessages([
                'outlet' => ['Atur outlet toko online di Setup situs sebelum konfirmasi order.'],
            ]);
        }

        $inventory = app(InventoryService::class);
        $warehouseId = $storefront->warehouse_id
            ? (int) $storefront->warehouse_id
            : (int) $inventory->resolveDefaultWarehouse((int) $order->company_id, $outletId)->id;

        $clientUuid = $order->client_uuid ?: ('sf-order-'.$order->id);
        $existing = Sale::query()->where('client_uuid', $clientUuid)->first();
        if ($existing) {
            return $this->loadSale($existing);
        }

        $channel = 'storefront';
        if ($storefront->priceChannel?->code) {
            $channel = (string) $storefront->priceChannel->code;
        }

        $this->forceWarehouseId = $warehouseId;
        try {
            $sale = DB::transaction(function () use ($order, $user, $outletId, $clientUuid, $channel) {
                $items = $order->items;
                if ($items->isEmpty()) {
                    throw ValidationException::withMessages([
                        'items' => ['Order tidak punya item.'],
                    ]);
                }

                $productIds = $items->pluck('product_id')->unique()->all();
                $products = Product::query()
                    ->with(['bomItems.component'])
                    ->whereIn('id', $productIds)
                    ->get()
                    ->keyBy('id');

                $lineItems = [];
                $subtotal = 0;
                foreach ($items as $index => $item) {
                    $product = $products->get((int) $item->product_id);
                    if (! $product) {
                        throw ValidationException::withMessages([
                            "items.{$index}" => ['Produk tidak ditemukan: '.$item->name_snapshot],
                        ]);
                    }
                    $qty = (int) $item->qty;
                    $price = (int) $item->unit_price;
                    $lineBase = $qty * $price;
                    $subtotal += $lineBase;
                    $lineItems[] = [
                        'product' => $product,
                        'qty' => $qty,
                        'price' => $price,
                        'discount' => 0,
                        'line_base' => $lineBase,
                        'tax' => 0,
                        'total' => $lineBase,
                        'name_snapshot' => (string) $item->name_snapshot,
                    ];
                }

                $orderSubtotal = (int) $order->subtotal;
                if ($orderSubtotal > 0 && $subtotal !== $orderSubtotal) {
                    // Prefer order snapshot totals if line math drifts.
                    $subtotal = $orderSubtotal;
                }

                $discount = (int) $order->discount;
                $tax = (int) $order->tax;
                $total = max(0, $subtotal - $discount + $tax);
                $shipping = (int) $order->shipping_cost;
                $noteParts = ['Storefront '.$order->number];
                if ($shipping > 0) {
                    $noteParts[] = 'Ongkir '.$shipping.' (di order web)';
                }
                if ($order->note) {
                    $noteParts[] = (string) $order->note;
                }

                $sale = Sale::query()->create([
                    'company_id' => $order->company_id,
                    'outlet_id' => $outletId,
                    'user_id' => $user->id,
                    'contact_id' => $order->contact_id,
                    'discount_id' => null,
                    'promotion_id' => null,
                    'channel' => $channel,
                    'number' => $this->nextNumber((int) $order->company_id),
                    'client_uuid' => $clientUuid,
                    'status' => 'paid',
                    'sold_at' => now(),
                    'subtotal' => $subtotal,
                    'discount' => $discount,
                    'tax' => $tax,
                    'total' => $total,
                    'paid_amount' => $total,
                    'change_amount' => 0,
                    'note' => implode(' · ', $noteParts),
                ]);

                foreach ($lineItems as $line) {
                    /** @var Product $product */
                    $product = $line['product'];
                    $hasBomStock = $product->bomItems->contains(
                        fn ($row) => (bool) ($row->component?->track_stock),
                    );

                    $costSnapshot = (int) $product->cost_price;
                    if ($product->track_stock && ! $hasBomStock) {
                        $adj = $this->adjustStock($sale, $product, -1 * $line['qty'], 'sale', 'Penjualan '.$sale->number);
                        $costSnapshot = $adj->unitCost;
                    }

                    SaleItem::query()->create([
                        'company_id' => $order->company_id,
                        'sale_id' => $sale->id,
                        'product_id' => $product->id,
                        'name_snapshot' => $line['name_snapshot'] !== '' ? $line['name_snapshot'] : $product->name,
                        'qty' => $line['qty'],
                        'unit' => $product->unit,
                        'price' => $line['price'],
                        'discount' => $line['discount'],
                        'tax' => $line['tax'],
                        'total' => $line['total'],
                        'cost_snapshot' => $costSnapshot,
                    ]);

                    if ($hasBomStock) {
                        $this->explodeBomStock($sale, $product, (int) $line['qty'], -1, 'sale', 'Penjualan '.$sale->number);
                    }
                }

                $sale->payments()->create([
                    'company_id' => $order->company_id,
                    'outlet_id' => $outletId,
                    'user_id' => $user->id,
                    'direction' => 'in',
                    'method' => 'transfer',
                    'amount' => $total,
                    'paid_at' => now(),
                    'client_uuid' => $clientUuid.'-p0',
                    'note' => 'Konfirmasi transfer storefront '.$order->number,
                ]);

                $sale = $this->loadSale($sale->fresh());
                app(GlPostingService::class)->postSale($sale, $user);

                return $sale;
            });

            $this->bumpSalesReportCache((int) $sale->company_id);

            return $sale;
        } catch (UniqueConstraintViolationException) {
            $sale = Sale::query()->where('client_uuid', $clientUuid)->first();
            if ($sale) {
                return $this->loadSale($sale);
            }
            throw ValidationException::withMessages([
                'client_uuid' => ['Transaksi penjualan sudah ada.'],
            ]);
        } finally {
            $this->forceWarehouseId = null;
        }
    }

    public function addPayment(Sale $sale, array $payload, User $user): Sale
    {
        if ($sale->status === 'cancelled') {
            throw ValidationException::withMessages([
                'sale' => ['Penjualan sudah dibatalkan.'],
            ]);
        }

        try {
            return DB::transaction(function () use ($sale, $payload, $user) {
                $sale = Sale::query()->whereKey($sale->id)->lockForUpdate()->firstOrFail();

                if ($sale->status === 'cancelled') {
                    throw ValidationException::withMessages([
                        'sale' => ['Penjualan sudah dibatalkan.'],
                    ]);
                }

                $clientUuid = $payload['client_uuid'] ?? $this->nextPaymentUuid($sale);

                $existing = Payment::query()->where('client_uuid', $clientUuid)->first();
                if ($existing) {
                    return $this->loadSale($sale);
                }

                $amount = (int) $payload['amount'];
                if ($amount <= 0) {
                    throw ValidationException::withMessages([
                        'amount' => ['Nominal pembayaran tidak valid.'],
                    ]);
                }

                $remaining = max(0, (int) $sale->total - (int) $sale->paid_amount);
                if ($remaining <= 0) {
                    throw ValidationException::withMessages([
                        'sale' => ['Penjualan sudah lunas.'],
                    ]);
                }

                $method = (string) ($payload['method'] ?? 'cash');
                // Non-cash cannot overpay; cash may overpay so change can be returned.
                if ($method !== 'cash' && $amount > $remaining) {
                    throw ValidationException::withMessages([
                        'amount' => ['Nominal melebihi sisa tagihan ('.$remaining.').'],
                    ]);
                }

                $payment = $sale->payments()->create([
                    'company_id' => $sale->company_id,
                    'outlet_id' => $sale->outlet_id,
                    'user_id' => $user->id,
                    'direction' => 'in',
                    'method' => $method,
                    'amount' => $amount,
                    'paid_at' => now(),
                    'client_uuid' => $clientUuid,
                    'note' => $payload['note'] ?? null,
                ]);

                $this->recalculatePayments($sale);
                app(GlPostingService::class)->postSalePayment($sale->fresh(['payments']), $payment, $user);

                return $this->loadSale($sale->fresh());
            });
        } catch (UniqueConstraintViolationException) {
            $clientUuid = $payload['client_uuid'] ?? null;
            if ($clientUuid) {
                $existing = Payment::query()->where('client_uuid', $clientUuid)->first();
                if ($existing) {
                    return $this->loadSale($sale->fresh());
                }
            }

            throw ValidationException::withMessages([
                'client_uuid' => ['Pembayaran sudah tercatat.'],
            ]);
        }
    }

    public function cancel(Sale $sale, User $user): Sale
    {
        if ($sale->status === 'cancelled') {
            return $this->loadSale($sale);
        }

        $cancelled = DB::transaction(function () use ($sale, $user) {
            $sale = Sale::query()->whereKey($sale->id)->lockForUpdate()->firstOrFail();

            if ($sale->status === 'cancelled') {
                return $this->loadSale($sale);
            }

            $this->reverseSaleStock($sale);

            app(GlPostingService::class)->reverseSale($sale, $user);

            $updated = Sale::query()
                ->whereKey($sale->id)
                ->where('status', '!=', 'cancelled')
                ->update([
                    'status' => 'cancelled',
                    'cancelled_at' => now(),
                    'cancelled_by' => $user->id,
                ]);

            if ($updated === 0) {
                return $this->loadSale($sale->fresh());
            }

            return $this->loadSale($sale->fresh());
        });
        $this->bumpSalesReportCache((int) $cancelled->company_id);

        return $cancelled;
    }

    public function receipt(Sale $sale): array
    {
        $sale = $this->loadSale($sale);
        $company = CurrentCompany::company();
        $settings = array_merge($company?->defaultSettings() ?? [], $company?->settings ?? []);

        return [
            'company' => [
                'name' => $company?->name,
                'phone' => $company?->phone,
                'address' => $company?->address,
                'logo' => $company?->logoUrl(),
            ],
            'outlet' => $sale->outlet ? [
                'id' => $sale->outlet->id,
                'name' => $sale->outlet->name,
            ] : null,
            'sale' => $this->serialize($sale),
            'footer' => $settings['receipt_footer'] ?? 'Terima kasih',
            'receipt_width' => (int) ($settings['receipt_width'] ?? 80),
            'layout' => ReceiptLayout::normalize($settings['receipt_layout'] ?? null, $settings),
            'cashier' => $sale->user?->name,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function settlement(User $user): array
    {
        $company = CurrentCompany::company();
        $outlet = CurrentCompany::outlet();
        $settings = array_merge($company?->defaultSettings() ?? [], $company?->settings ?? []);
        $from = now()->startOfDay();
        $to = now();

        $base = Sale::query()
            ->when($outlet?->id, fn ($q) => $q->where('outlet_id', $outlet->id))
            ->whereBetween('sold_at', [$from, $to]);

        $active = (clone $base)->where('status', '!=', 'cancelled');
        $salesCount = (clone $active)->count();
        $subtotal = (int) (clone $active)->sum('subtotal');
        $discount = (int) (clone $active)->sum('discount');
        $tax = (int) (clone $active)->sum('tax');
        $revenue = (int) (clone $active)->sum('total');
        $paid = (int) (clone $active)->sum('paid_amount');
        $change = (int) (clone $active)->sum('change_amount');
        $cancelledCount = (clone $base)->where('status', 'cancelled')->count();
        $firstSaleAt = (clone $active)->min('sold_at');
        $lastSaleAt = (clone $active)->max('sold_at');
        $saleIds = (clone $active)->pluck('id');

        $itemsSold = $saleIds->isEmpty()
            ? 0
            : (int) SaleItem::query()->whereIn('sale_id', $saleIds)->sum('qty');

        $methods = [
            'cash' => ['count' => 0, 'amount' => 0],
            'transfer' => ['count' => 0, 'amount' => 0],
            'qris' => ['count' => 0, 'amount' => 0],
        ];
        if ($saleIds->isNotEmpty()) {
            $rows = Payment::query()
                ->where('payable_type', 'sale')
                ->whereIn('payable_id', $saleIds)
                ->selectRaw('method, count(*) as tx, coalesce(sum(amount), 0) as total')
                ->groupBy('method')
                ->get();
            foreach ($rows as $row) {
                $method = (string) $row->method;
                if (isset($methods[$method])) {
                    $methods[$method] = [
                        'count' => (int) $row->tx,
                        'amount' => (int) $row->total,
                    ];
                }
            }
        }

        $cashiers = [];
        if ($saleIds->isNotEmpty()) {
            $rows = Sale::query()
                ->whereIn('id', $saleIds)
                ->selectRaw('user_id, count(*) as sales_count, coalesce(sum(total), 0) as revenue')
                ->groupBy('user_id')
                ->orderByDesc('revenue')
                ->get();
            $names = User::query()
                ->whereIn('id', $rows->pluck('user_id')->filter())
                ->pluck('name', 'id');
            foreach ($rows as $row) {
                $cashiers[] = [
                    'name' => $names[$row->user_id] ?? '—',
                    'sales_count' => (int) $row->sales_count,
                    'revenue' => (int) $row->revenue,
                ];
            }
        }

        $width = (int) ($settings['receipt_width'] ?? 80);

        return [
            'company' => [
                'name' => $company?->name,
                'phone' => $company?->phone,
                'address' => $company?->address,
                'logo' => $company?->logoUrl(),
            ],
            'outlet' => $outlet ? [
                'id' => $outlet->id,
                'name' => $outlet->name,
            ] : null,
            'cashier' => $user->name,
            'printed_at' => now()->toIso8601String(),
            'date' => $from->toDateString(),
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'receipt_width' => in_array($width, [58, 80], true) ? $width : 80,
            'sales_count' => $salesCount,
            'cancelled_count' => $cancelledCount,
            'items_sold' => $itemsSold,
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax' => $tax,
            'revenue' => $revenue,
            'paid' => $paid,
            'change' => $change,
            'cash_net' => $this->cashNet($saleIds, (int) $methods['cash']['amount']),
            'average_ticket' => $salesCount > 0 ? (int) round($revenue / $salesCount) : 0,
            'first_sale_at' => $firstSaleAt ? \Illuminate\Support\Carbon::parse($firstSaleAt)->toIso8601String() : null,
            'last_sale_at' => $lastSaleAt ? \Illuminate\Support\Carbon::parse($lastSaleAt)->toIso8601String() : null,
            'payment_methods' => $methods,
            'cashiers' => $cashiers,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function salesReport(string $kind, string $fromDate, string $toDate, ?int $outletId = null): array
    {
        $companyId = CurrentCompany::id();
        $outletId ??= CurrentCompany::outlet()?->id;

        if (! $companyId) {
            return $this->salesReportUncached($kind, $fromDate, $toDate, $outletId);
        }

        $suffix = implode(':', [
            $kind,
            $fromDate,
            $toDate,
            $outletId ?? 'all',
        ]);

        return TenantCache::rememberVersioned($companyId, 'sales_reports', $suffix, 300, fn () => $this->salesReportUncached(
            $kind,
            $fromDate,
            $toDate,
            $outletId,
        ));
    }

    /**
     * @return array<string, mixed>
     */
    public function salesReportUncached(string $kind, string $fromDate, string $toDate, ?int $outletId = null): array
    {
        $from = \Illuminate\Support\Carbon::parse($fromDate)->startOfDay();
        $to = \Illuminate\Support\Carbon::parse($toDate)->endOfDay();
        if ($from->gt($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }
        if ($from->diffInDays($to) > 366) {
            $from = $to->copy()->subDays(366)->startOfDay();
        }

        $outletId ??= CurrentCompany::outlet()?->id;
        $active = Sale::query()
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->whereBetween('sold_at', [$from, $to])
            ->where('status', '!=', 'cancelled');

        $meta = [
            'kind' => $kind,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
        ];

        return match ($kind) {
            'products' => [...$meta, ...$this->reportEngineering($from, $to, $outletId)],
            'cashiers' => [...$meta, 'rows' => $this->reportCashiers($active)],
            'methods' => [...$meta, ...$this->reportMethods($active, $from, $to, $outletId)],
            'channels' => [...$meta, 'rows' => $this->reportChannels($active)],
            'daily' => [...$meta, 'rows' => $this->reportDaily($active)],
            default => [...$meta, ...$this->reportSummary($active, $from, $to, $outletId)],
        };
    }

    private function bumpSalesReportCache(?int $companyId): void
    {
        if ($companyId) {
            TenantCache::bump($companyId, 'sales_reports');
        }
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<Sale>  $active
     * @return array<string, mixed>
     */
    private function reportSummary($active, \Illuminate\Support\Carbon $from, \Illuminate\Support\Carbon $to, ?int $outletId): array
    {
        $base = Sale::query()
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->whereBetween('sold_at', [$from, $to]);

        $salesCount = (clone $active)->count();
        $revenue = (int) (clone $active)->sum('total');
        $paid = (int) (clone $active)->sum('paid_amount');
        $change = (int) (clone $active)->sum('change_amount');
        $discount = (int) (clone $active)->sum('discount');
        $tax = (int) (clone $active)->sum('tax');
        $cancelledCount = (clone $base)->where('status', 'cancelled')->count();
        $methods = $this->reportMethods($active, $from, $to, $outletId);

        $itemsSold = (int) SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', '!=', 'cancelled')
            ->whereBetween('sales.sold_at', [$from, $to])
            ->when($outletId, fn ($q) => $q->where('sales.outlet_id', $outletId))
            ->sum('sale_items.qty');

        return [
            'sales_count' => $salesCount,
            'cancelled_count' => $cancelledCount,
            'items_sold' => $itemsSold,
            'subtotal' => (int) (clone $active)->sum('subtotal'),
            'discount' => $discount,
            'tax' => $tax,
            'revenue' => $revenue,
            'paid' => $paid,
            'change' => $change,
            'cash_net' => $methods['cash_net'],
            'average_ticket' => $salesCount > 0 ? (int) round($revenue / $salesCount) : 0,
            'payment_methods' => $methods['payment_methods'],
            'top_products' => array_slice($this->reportProducts($active, $from, $to, $outletId), 0, 5),
        ];
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<Sale>  $active
     * @return list<array<string, mixed>>
     */
    private function reportProducts($active, \Illuminate\Support\Carbon $from, \Illuminate\Support\Carbon $to, ?int $outletId): array
    {
        unset($active);

        return SaleItem::query()
            ->selectRaw('sale_items.product_id, sale_items.name_snapshot as name, coalesce(sum(sale_items.qty), 0) as qty, coalesce(sum(sale_items.discount), 0) as discount, coalesce(sum(sale_items.total), 0) as revenue')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', '!=', 'cancelled')
            ->whereBetween('sales.sold_at', [$from, $to])
            ->when($outletId, fn ($q) => $q->where('sales.outlet_id', $outletId))
            ->groupBy('sale_items.product_id', 'sale_items.name_snapshot')
            ->orderByDesc('revenue')
            ->limit(200)
            ->get()
            ->map(fn ($row) => [
                'product_id' => $row->product_id ? (int) $row->product_id : null,
                'name' => (string) $row->name,
                'qty' => (int) $row->qty,
                'discount' => (int) $row->discount,
                'revenue' => (int) $row->revenue,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{categories: list<array<string, mixed>>, grand_total: array{qty: int, discount: int, revenue: int}}
     */
    private function reportEngineering(\Illuminate\Support\Carbon $from, \Illuminate\Support\Carbon $to, ?int $outletId): array
    {
        $uncategorized = 'Tanpa kategori';

        $rows = SaleItem::query()
            ->selectRaw('coalesce(categories.id, 0) as category_id, coalesce(categories.name, ?) as category_name, sale_items.product_id, sale_items.name_snapshot as name, coalesce(sum(sale_items.qty), 0) as qty, coalesce(sum(sale_items.discount), 0) as discount, coalesce(sum(sale_items.total), 0) as revenue', [$uncategorized])
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->leftJoin('products', 'products.id', '=', 'sale_items.product_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->where('sales.status', '!=', 'cancelled')
            ->whereBetween('sales.sold_at', [$from, $to])
            ->when($outletId, fn ($q) => $q->where('sales.outlet_id', $outletId))
            ->groupBy('categories.id', 'categories.name', 'sale_items.product_id', 'sale_items.name_snapshot')
            ->orderBy('category_name')
            ->orderByDesc('revenue')
            ->get();

        $groups = [];
        foreach ($rows as $row) {
            $categoryId = (int) $row->category_id;
            if (! isset($groups[$categoryId])) {
                $groups[$categoryId] = [
                    'category_id' => $categoryId,
                    'category_name' => (string) $row->category_name,
                    'qty' => 0,
                    'discount' => 0,
                    'revenue' => 0,
                    'products' => [],
                ];
            }

            $product = [
                'product_id' => $row->product_id ? (int) $row->product_id : null,
                'name' => (string) $row->name,
                'qty' => (int) $row->qty,
                'discount' => (int) $row->discount,
                'revenue' => (int) $row->revenue,
            ];

            $groups[$categoryId]['products'][] = $product;
            $groups[$categoryId]['qty'] += $product['qty'];
            $groups[$categoryId]['discount'] += $product['discount'];
            $groups[$categoryId]['revenue'] += $product['revenue'];
        }

        $categories = array_values($groups);
        usort($categories, fn ($a, $b) => strcasecmp((string) $a['category_name'], (string) $b['category_name']));

        $grandTotal = ['qty' => 0, 'discount' => 0, 'revenue' => 0];
        foreach ($categories as $category) {
            $grandTotal['qty'] += $category['qty'];
            $grandTotal['discount'] += $category['discount'];
            $grandTotal['revenue'] += $category['revenue'];
        }

        return [
            'categories' => $categories,
            'grand_total' => $grandTotal,
        ];
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<Sale>  $active
     * @return list<array<string, mixed>>
     */
    private function reportCashiers($active): array
    {
        $rows = (clone $active);
        $rows->getQuery()->columns = null;
        $rows = $rows
            ->selectRaw('user_id, count(*) as sales_count, coalesce(sum(discount), 0) as discount, coalesce(sum(total), 0) as revenue, coalesce(sum(paid_amount), 0) as paid')
            ->groupBy('user_id')
            ->orderByDesc('revenue')
            ->get();

        $names = User::query()
            ->whereIn('id', $rows->pluck('user_id')->filter())
            ->pluck('name', 'id');

        return $rows->map(fn ($row) => [
            'name' => $names[$row->user_id] ?? '—',
            'sales_count' => (int) $row->sales_count,
            'discount' => (int) $row->discount,
            'revenue' => (int) $row->revenue,
            'paid' => (int) $row->paid,
        ])->values()->all();
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<Sale>  $active
     * @return array{payment_methods: array<string, array{count: int, amount: int}>, cash_net: int, change: int}
     */
    private function reportMethods($active, \Illuminate\Support\Carbon $from, \Illuminate\Support\Carbon $to, ?int $outletId): array
    {
        $methods = [
            'cash' => ['count' => 0, 'amount' => 0],
            'transfer' => ['count' => 0, 'amount' => 0],
            'qris' => ['count' => 0, 'amount' => 0],
        ];

        $rows = Payment::query()
            ->selectRaw('payments.method, count(*) as tx, coalesce(sum(payments.amount), 0) as total')
            ->join('sales', 'sales.id', '=', 'payments.payable_id')
            ->where('payments.payable_type', 'sale')
            ->where('sales.status', '!=', 'cancelled')
            ->whereBetween('sales.sold_at', [$from, $to])
            ->when($outletId, fn ($q) => $q->where('sales.outlet_id', $outletId))
            ->groupBy('payments.method')
            ->get();

        foreach ($rows as $row) {
            $method = (string) $row->method;
            if (isset($methods[$method])) {
                $methods[$method] = [
                    'count' => (int) $row->tx,
                    'amount' => (int) $row->total,
                ];
            }
        }

        $change = (int) (clone $active)->sum('change_amount');
        $saleIds = (clone $active)->pluck('id');

        return [
            'payment_methods' => $methods,
            'change' => $change,
            'cash_net' => $this->cashNet($saleIds, (int) $methods['cash']['amount']),
        ];
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<Sale>  $active
     * @return list<array<string, mixed>>
     */
    private function reportChannels($active): array
    {
        $query = clone $active;
        $query->getQuery()->columns = null;

        return $query
            ->selectRaw("coalesce(nullif(channel, ''), 'pos') as channel_code, count(*) as sales_count, coalesce(sum(total), 0) as revenue")
            ->groupByRaw("coalesce(nullif(channel, ''), 'pos')")
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($row) => [
                'channel' => (string) $row->channel_code,
                'sales_count' => (int) $row->sales_count,
                'revenue' => (int) $row->revenue,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<Sale>  $active
     * @return list<array<string, mixed>>
     */
    private function reportDaily($active): array
    {
        $query = clone $active;
        $query->getQuery()->columns = null;

        return $query
            ->selectRaw('date(sold_at) as day, count(*) as sales_count, coalesce(sum(discount), 0) as discount, coalesce(sum(tax), 0) as tax, coalesce(sum(total), 0) as revenue')
            ->groupByRaw('date(sold_at)')
            ->orderBy('day')
            ->get()
            ->map(fn ($row) => [
                'day' => (string) $row->day,
                'sales_count' => (int) $row->sales_count,
                'discount' => (int) $row->discount,
                'tax' => (int) $row->tax,
                'revenue' => (int) $row->revenue,
            ])
            ->values()
            ->all();
    }

    public function serialize(Sale $sale): array
    {
        $sale->loadMissing(['items', 'payments', 'contact', 'user', 'outlet', 'discountPreset', 'promotionPreset']);

        return [
            'id' => $sale->id,
            'number' => $sale->number,
            'client_uuid' => $sale->client_uuid,
            'status' => $sale->status,
            'channel' => $sale->channel,
            'sold_at' => $sale->sold_at?->toIso8601String(),
            'contact_id' => $sale->contact_id,
            'discount_id' => $sale->discount_id,
            'discount_name' => $sale->discountPreset?->name,
            'promotion_id' => $sale->promotion_id,
            'promotion_name' => $sale->promotionPreset?->name,
            'contact' => $sale->contact?->only(['id', 'name', 'phone']),
            'cashier' => $sale->user?->only(['id', 'name']),
            'outlet' => $sale->outlet?->only(['id', 'name']),
            'subtotal' => $sale->subtotal,
            'discount' => $sale->discount,
            'tax' => $sale->tax,
            'total' => $sale->total,
            'paid_amount' => $sale->paid_amount,
            'change_amount' => $sale->change_amount,
            'note' => $sale->note,
            'cancelled_at' => $sale->cancelled_at?->toIso8601String(),
            'items' => $sale->items->map(fn (SaleItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'name' => $item->name_snapshot,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'price' => $item->price,
                'discount' => $item->discount,
                'tax' => $item->tax,
                'total' => $item->total,
            ])->values()->all(),
            'payments' => $sale->payments->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'method' => $payment->method,
                'amount' => $payment->amount,
                'paid_at' => $payment->paid_at?->toIso8601String(),
                'client_uuid' => $payment->client_uuid,
                'note' => $payment->note,
            ])->values()->all(),
        ];
    }

    private function createFresh(array $payload, User $user): Sale
    {
        $company = CurrentCompany::company();
        $outlet = CurrentCompany::outlet();

        if (! $company || ! $outlet) {
            throw ValidationException::withMessages([
                'company' => ['Perusahaan atau outlet tidak ditemukan.'],
            ]);
        }

        $settings = array_merge($company->defaultSettings(), $company->settings ?? []);
        $taxPercent = (float) ($settings['tax_percent'] ?? 0);
        $allowCredit = (bool) ($settings['allow_credit'] ?? true);

        $itemsInput = $payload['items'] ?? [];
        if ($itemsInput === []) {
            throw ValidationException::withMessages([
                'items' => ['Minimal satu item.'],
            ]);
        }

        $channelCode = (string) ($payload['channel'] ?? 'pos');
        $channelId = null;
        if ($channelCode !== '' && $channelCode !== 'pos') {
            $channelId = PriceChannel::query()
                ->where('code', $channelCode)
                ->where('is_active', true)
                ->value('id');
        }

        $productIds = collect($itemsInput)->pluck('product_id')->unique()->all();
        $products = Product::query()
            ->with(['outletPrices', 'channelPrices', 'bomItems.component'])
            ->whereIn('id', $productIds)
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        $lineItems = [];
        $subtotal = 0;
        $discountId = null;
        $promotionId = null;

        foreach ($itemsInput as $index => $row) {
            $product = $products->get((int) $row['product_id']);
            if (! $product) {
                throw ValidationException::withMessages([
                    "items.{$index}.product_id" => ['Produk tidak ditemukan.'],
                ]);
            }

            $qty = (int) $row['qty'];
            if ($qty <= 0) {
                throw ValidationException::withMessages([
                    "items.{$index}.qty" => ['Qty harus lebih dari 0.'],
                ]);
            }

            $price = $product->priceFor($outlet->id, $channelId);

            $lineItems[] = [
                'product' => $product,
                'qty' => $qty,
                'price' => $price,
            ];

            $subtotal += $qty * $price;
        }

        $itemDiscountTotal = 0;
        $saleDiscount = 0;
        $promoLines = array_map(fn ($line) => [
            'qty' => $line['qty'],
            'price' => $line['price'],
            'product_id' => $line['product']->id,
            'category_id' => $line['product']->category_id,
        ], $lineItems);

        if ((! empty($payload['promotion_id']) || ! empty($payload['promo_code'])) && ! empty($payload['discount_id'])) {
            throw ValidationException::withMessages([
                'promotion_id' => ['Promo tidak bisa digabung dengan diskon preset.'],
            ]);
        }

        $promotionService = app(PromotionService::class);
        $promotion = null;
        $skipAutoPromotion = (bool) ($payload['skip_auto_promotion'] ?? false);
        if (! empty($payload['promotion_id'])) {
            $promotion = $promotionService->findActive((int) $payload['promotion_id']);
        } elseif (! empty($payload['promo_code'])) {
            $promotion = $promotionService->findByCode(trim((string) $payload['promo_code']));
        } elseif (empty($payload['discount_id']) && ! $skipAutoPromotion) {
            $autoCandidates = Promotion::query()
                ->with(['products', 'categories'])
                ->where('is_active', true)
                ->where('apply_mode', 'auto')
                ->orderByDesc('priority')
                ->get();
            $promotion = $promotionService->bestAutoApply($autoCandidates, $promoLines, $subtotal);
        }

        if ($promotion) {
            $applied = $promotionService->apply($promotion, $promoLines, $subtotal);
            $saleDiscount = $applied['sale_discount'];
            foreach ($lineItems as $index => &$line) {
                $line['discount'] = $applied['item_discounts'][$index] ?? 0;
                $line['line_base'] = ($line['qty'] * $line['price']) - $line['discount'];
                if ($line['line_base'] < 0) {
                    throw ValidationException::withMessages([
                        'promotion_id' => ['Promo melebihi subtotal.'],
                    ]);
                }
                $itemDiscountTotal += $line['discount'];
            }
            unset($line);
            $promotionId = $promotion->id;
        } elseif (! empty($payload['discount_id'])) {
            $discount = app(DiscountService::class)->findActive((int) $payload['discount_id']);
            $applied = app(DiscountService::class)->apply(
                $discount,
                array_map(fn ($line) => ['qty' => $line['qty'], 'price' => $line['price']], $lineItems),
                $subtotal,
            );
            $saleDiscount = $applied['sale_discount'];
            foreach ($lineItems as $index => &$line) {
                $line['discount'] = $applied['item_discounts'][$index] ?? 0;
                $line['line_base'] = ($line['qty'] * $line['price']) - $line['discount'];
                if ($line['line_base'] < 0) {
                    throw ValidationException::withMessages([
                        'discount_id' => ['Diskon melebihi subtotal.'],
                    ]);
                }
                $itemDiscountTotal += $line['discount'];
            }
            unset($line);
            $discountId = $discount->id;
        } else {
            $discountId = null;
            foreach ($lineItems as $index => &$line) {
                $discount = (int) ($itemsInput[$index]['discount'] ?? 0);
                $line['discount'] = $discount;
                $line['line_base'] = ($line['qty'] * $line['price']) - $discount;
                if ($line['line_base'] < 0) {
                    throw ValidationException::withMessages([
                        "items.{$index}.discount" => ['Diskon melebihi subtotal.'],
                    ]);
                }
                $itemDiscountTotal += $discount;
            }
            unset($line);
            $saleDiscount = (int) ($payload['discount'] ?? 0);
        }

        $discount = $itemDiscountTotal + $saleDiscount;
        if ($saleDiscount > 0) {
            $this->allocateSaleDiscount($lineItems, $saleDiscount);
        }
        $taxable = max(0, $subtotal - $discount);
        $tax = (int) round($taxable * $taxPercent / 100);
        $total = $taxable + $tax;

        $remainingTax = $tax;
        $lastIndex = count($lineItems) - 1;
        foreach ($lineItems as $i => &$line) {
            if ($taxable === 0) {
                $line['tax'] = 0;
                $line['total'] = $line['line_base'];
                continue;
            }

            if ($i === $lastIndex) {
                $line['tax'] = $remainingTax;
            } else {
                $line['tax'] = (int) round($tax * ($line['line_base'] / $taxable));
                $remainingTax -= $line['tax'];
            }
            $line['total'] = $line['line_base'] + $line['tax'];
        }
        unset($line);

        $paymentsInput = $payload['payments'] ?? [];
        $paidAmount = 0;
        $remainingBill = $total;
        foreach ($paymentsInput as $index => $payment) {
            $amount = (int) ($payment['amount'] ?? 0);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    "payments.{$index}.amount" => ['Nominal pembayaran tidak valid.'],
                ]);
            }
            $method = (string) ($payment['method'] ?? 'cash');
            // Non-cash cannot overpay the remaining bill; cash may overpay for change.
            if ($method !== 'cash' && $amount > $remainingBill) {
                throw ValidationException::withMessages([
                    "payments.{$index}.amount" => ['Nominal melebihi sisa tagihan ('.$remainingBill.').'],
                ]);
            }
            $paidAmount += $amount;
            $remainingBill = max(0, $remainingBill - $amount);
        }

        if ($paidAmount < $total && ! $allowCredit) {
            throw ValidationException::withMessages([
                'payments' => ['Pembayaran kurang dari total.'],
            ]);
        }

        $status = $paidAmount >= $total ? 'paid' : 'unpaid';
        $changeAmount = max(0, $paidAmount - $total);

        $sale = Sale::query()->create([
            'company_id' => $company->id,
            'outlet_id' => $outlet->id,
            'user_id' => $user->id,
            'contact_id' => $payload['contact_id'] ?? null,
            'discount_id' => $discountId ?? null,
            'promotion_id' => $promotionId ?? null,
            'channel' => $payload['channel'] ?? 'pos',
            'number' => $this->nextNumber($company->id),
            'client_uuid' => $payload['client_uuid'],
            'status' => $status,
            'sold_at' => now(),
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax' => $tax,
            'total' => $total,
            'paid_amount' => $paidAmount,
            'change_amount' => $changeAmount,
            'note' => $payload['note'] ?? null,
        ]);

        foreach ($lineItems as $line) {
            /** @var Product $product */
            $product = $line['product'];

            $hasBomStock = $product->bomItems->contains(
                fn ($row) => (bool) ($row->component?->track_stock),
            );

            $costSnapshot = (int) $product->cost_price;
            // Recipe (BOM) products: deduct components only — avoid double-issuing FG + ingredients.
            if ($product->track_stock && ! $hasBomStock) {
                $adj = $this->adjustStock($sale, $product, -1 * $line['qty'], 'sale', 'Penjualan '.$sale->number);
                $costSnapshot = $adj->unitCost;
            }

            SaleItem::query()->create([
                'company_id' => $company->id,
                'sale_id' => $sale->id,
                'product_id' => $product->id,
                'name_snapshot' => $product->name,
                'qty' => $line['qty'],
                'unit' => $product->unit,
                'price' => $line['price'],
                'discount' => $line['discount'],
                'tax' => $line['tax'],
                'total' => $line['total'],
                'cost_snapshot' => $costSnapshot,
            ]);

            if ($hasBomStock) {
                $this->explodeBomStock($sale, $product, (int) $line['qty'], -1, 'sale', 'Penjualan '.$sale->number);
            }
        }

            foreach ($paymentsInput as $index => $payment) {
            $sale->payments()->create([
                'company_id' => $company->id,
                'outlet_id' => $outlet->id,
                'user_id' => $user->id,
                'direction' => 'in',
                'method' => $payment['method'] ?? 'cash',
                'amount' => (int) $payment['amount'],
                'paid_at' => now(),
                'client_uuid' => $payment['client_uuid'] ?? $payload['client_uuid'].'-p'.$index,
                'note' => $payment['note'] ?? null,
            ]);
        }

        $sale = $this->loadSale($sale->fresh());
        app(GlPostingService::class)->postSale($sale, $user);

        return $sale;
    }

    private function nextNumber(int $companyId): string
    {
        return app(DocumentSequenceService::class)->next($companyId, 'sale_invoice', 'INV', 4);
    }

    /**
     * Reverse stock using original sale movements so cancel matches what was issued
     * (BOM unit conversion / leaf explode stay consistent even if recipes change later).
     */
    private function reverseSaleStock(Sale $sale): void
    {
        $movements = StockMovement::query()
            ->withoutGlobalScopes()
            ->where('company_id', $sale->company_id)
            ->where('ref_type', 'sale')
            ->where('ref_id', $sale->id)
            ->orderBy('id')
            ->get();

        if ($movements->isEmpty()) {
            // Legacy fallback: recompute from items (pre-movement-aware cancel).
            $sale->loadMissing('items.product.bomItems.component');
            foreach ($sale->items as $item) {
                $product = $item->product;
                if (! $product) {
                    continue;
                }
                $hasBomStock = $product->bomItems->contains(
                    fn ($row) => (bool) ($row->component?->track_stock),
                );
                if ($product->track_stock && ! $hasBomStock) {
                    $this->adjustStock(
                        $sale,
                        $product,
                        (int) $item->qty,
                        'cancel',
                        'Pembatalan '.$sale->number,
                        (int) $item->cost_snapshot,
                        true,
                    );
                }
                if ($hasBomStock) {
                    $this->explodeBomStock($sale, $product, (int) $item->qty, 1, 'cancel', 'Pembatalan '.$sale->number, true);
                }
            }

            return;
        }

        $inventory = app(InventoryService::class);
        foreach ($movements as $movement) {
            $qtyChange = -1 * (int) $movement->qty_change;
            if ($qtyChange === 0) {
                continue;
            }
            $inventory->adjust(
                (int) $sale->company_id,
                (int) $movement->warehouse_id,
                (int) $movement->product_id,
                $qtyChange,
                'cancel',
                'sale',
                (int) $sale->id,
                'Pembatalan '.$sale->number,
                $movement->outlet_id ? (int) $movement->outlet_id : (int) $sale->outlet_id,
                null,
                (int) $movement->unit_cost,
                true,
            );
        }
    }

    private function explodeBomStock(
        Sale $sale,
        Product $product,
        int $soldQty,
        int $sign,
        string $type,
        string $note,
        bool $reverseCosting = false,
    ): void {
        if ($soldQty < 1) {
            return;
        }

        $lines = app(BomExplosionService::class)->explodeLeaves(
            (int) $sale->company_id,
            (int) $product->id,
            $soldQty,
        );

        if ($lines === []) {
            return;
        }

        $components = Product::query()
            ->withoutGlobalScopes()
            ->whereIn('id', array_column($lines, 'product_id'))
            ->get()
            ->keyBy('id');

        foreach ($lines as $line) {
            $component = $components->get($line['product_id']);
            if (! $component || ! $component->track_stock) {
                continue;
            }

            $qty = (int) $line['qty_planned'];
            if ($qty === 0) {
                continue;
            }

            $this->adjustStock(
                $sale,
                $component,
                $sign * $qty,
                $type,
                $note.' · BOM '.$product->name,
                null,
                $reverseCosting,
            );
        }
    }

    /**
     * @param  list<array<string, mixed>>  $lineItems
     */
    private function allocateSaleDiscount(array &$lineItems, int $saleDiscount): void
    {
        $baseSum = 0;
        foreach ($lineItems as $line) {
            $baseSum += (int) $line['line_base'];
        }
        if ($saleDiscount <= 0 || $baseSum <= 0) {
            return;
        }
        if ($saleDiscount > $baseSum) {
            throw ValidationException::withMessages([
                'discount' => ['Diskon melebihi subtotal.'],
            ]);
        }

        $remaining = $saleDiscount;
        $lastIndex = count($lineItems) - 1;
        foreach ($lineItems as $i => &$line) {
            if ($i === $lastIndex) {
                $alloc = $remaining;
            } else {
                $alloc = (int) floor($saleDiscount * ((int) $line['line_base']) / $baseSum);
                $remaining -= $alloc;
            }
            $line['discount'] = (int) $line['discount'] + $alloc;
            $line['line_base'] = (int) $line['line_base'] - $alloc;
        }
        unset($line);
    }

    /**
     * Cash in drawer = cash tenders minus change only for tickets that took cash.
     *
     * @param  Collection<int, int|string>|list<int>  $saleIds
     */
    private function cashNet($saleIds, int $cashAmount): int
    {
        $ids = $saleIds instanceof Collection ? $saleIds : collect($saleIds);
        if ($ids->isEmpty() || $cashAmount <= 0) {
            return max(0, $cashAmount);
        }

        $cashSaleIds = Payment::query()
            ->where('payable_type', 'sale')
            ->whereIn('payable_id', $ids->all())
            ->where('method', 'cash')
            ->distinct()
            ->pluck('payable_id');

        if ($cashSaleIds->isEmpty()) {
            return max(0, $cashAmount);
        }

        $cashChange = (int) Sale::query()
            ->whereIn('id', $cashSaleIds)
            ->where('status', '!=', 'cancelled')
            ->sum('change_amount');

        return max(0, $cashAmount - $cashChange);
    }

    private function assertIdempotentPayload(Sale $sale, array $payload): void
    {
        $sale->loadMissing('items');
        $incoming = collect($payload['items'] ?? [])
            ->map(fn ($row) => [(int) ($row['product_id'] ?? 0), (int) ($row['qty'] ?? 0)])
            ->sort()
            ->values()
            ->all();
        $stored = $sale->items
            ->map(fn (SaleItem $item) => [(int) $item->product_id, (int) $item->qty])
            ->sort()
            ->values()
            ->all();

        if ($incoming !== $stored) {
            throw ValidationException::withMessages([
                'client_uuid' => ['UUID transaksi sudah dipakai untuk keranjang berbeda.'],
            ]);
        }
    }

    private function adjustStock(
        Sale $sale,
        Product $product,
        int $qtyChange,
        string $type,
        string $note,
        ?int $unitCost = null,
        bool $reverseCosting = false,
    ): \App\Support\InventoryAdjustment {
        $inventory = app(InventoryService::class);
        $warehouse = $this->forceWarehouseId
            ? Warehouse::query()->withoutGlobalScopes()->whereKey($this->forceWarehouseId)->first()
            : null;
        $warehouse ??= $inventory->resolveDefaultWarehouse((int) $sale->company_id, (int) $sale->outlet_id);

        return $inventory->adjust(
            (int) $sale->company_id,
            (int) $warehouse->id,
            (int) $product->id,
            $qtyChange,
            $type,
            'sale',
            (int) $sale->id,
            $note,
            (int) $sale->outlet_id,
            null,
            $unitCost,
            $reverseCosting,
        );
    }

    private function recalculatePayments(Sale $sale): void
    {
        $paid = (int) $sale->payments()->sum('amount');
        $sale->paid_amount = $paid;
        $sale->change_amount = max(0, $paid - (int) $sale->total);

        if ($sale->status !== 'cancelled') {
            $sale->status = $paid >= (int) $sale->total ? 'paid' : 'unpaid';
        }

        $sale->save();
    }

    private function nextPaymentUuid(Sale $sale): string
    {
        $count = $sale->payments()->count();

        return $sale->client_uuid.'-p'.$count;
    }

    private function loadSale(Sale $sale): Sale
    {
        return $sale->load(['items', 'payments', 'contact', 'user', 'outlet', 'discountPreset', 'promotionPreset']);
    }
}
