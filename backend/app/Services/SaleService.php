<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PriceChannel;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Support\CurrentCompany;
use App\Support\ReceiptLayout;
use App\Support\TenantCache;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleService
{
    public function create(array $payload, User $user): Sale
    {
        $existing = Sale::query()->where('client_uuid', $payload['client_uuid'])->first();

        if ($existing) {
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
                return $this->loadSale($sale);
            }

            throw ValidationException::withMessages([
                'client_uuid' => ['Transaksi sudah ada.'],
            ]);
        }
    }

    public function addPayment(Sale $sale, array $payload, User $user): Sale
    {
        if ($sale->status === 'cancelled') {
            throw ValidationException::withMessages([
                'sale' => ['Penjualan sudah dibatalkan.'],
            ]);
        }

        return DB::transaction(function () use ($sale, $payload, $user) {
            $sale = Sale::query()->whereKey($sale->id)->lockForUpdate()->firstOrFail();

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

            $sale->payments()->create([
                'company_id' => $sale->company_id,
                'outlet_id' => $sale->outlet_id,
                'user_id' => $user->id,
                'direction' => 'in',
                'method' => $payload['method'],
                'amount' => $amount,
                'paid_at' => now(),
                'client_uuid' => $clientUuid,
                'note' => $payload['note'] ?? null,
            ]);

            $this->recalculatePayments($sale);

            return $this->loadSale($sale->fresh());
        });
    }

    public function cancel(Sale $sale, User $user): Sale
    {
        if ($sale->status === 'cancelled') {
            return $this->loadSale($sale);
        }

        $cancelled = DB::transaction(function () use ($sale, $user) {
            $sale = Sale::query()->whereKey($sale->id)->lockForUpdate()->with('items.product.bomItems.component')->firstOrFail();

            foreach ($sale->items as $item) {
                $product = $item->product;
                if ($product?->track_stock) {
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
                if ($product) {
                    $this->explodeBomStock($sale, $product, (int) $item->qty, 1, 'cancel', 'Pembatalan '.$sale->number, true);
                }
            }

            $sale->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancelled_by' => $user->id,
            ]);

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
            'cash_net' => max(0, $methods['cash']['amount'] - $change),
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

        return [
            'payment_methods' => $methods,
            'change' => $change,
            'cash_net' => max(0, $methods['cash']['amount'] - $change),
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
        if (! empty($payload['promotion_id'])) {
            $promotion = $promotionService->findActive((int) $payload['promotion_id']);
        } elseif (! empty($payload['promo_code'])) {
            $promotion = $promotionService->findByCode(trim((string) $payload['promo_code']));
        } elseif (empty($payload['discount_id'])) {
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
        foreach ($paymentsInput as $index => $payment) {
            $amount = (int) ($payment['amount'] ?? 0);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    "payments.{$index}.amount" => ['Nominal pembayaran tidak valid.'],
                ]);
            }
            $paidAmount += $amount;
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

            $costSnapshot = (int) $product->cost_price;
            if ($product->track_stock) {
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

            $this->explodeBomStock($sale, $product, (int) $line['qty'], -1, 'sale', 'Penjualan '.$sale->number);
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

        return $this->loadSale($sale->fresh());
    }

    private function nextNumber(int $companyId): string
    {
        $prefix = 'INV-'.now()->format('ymd').'-';

        $last = Sale::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('number', 'like', $prefix.'%')
            ->orderByDesc('number')
            ->lockForUpdate()
            ->value('number');

        $seq = $last ? ((int) substr((string) $last, -3)) + 1 : 1;

        return $prefix.str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
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
        $items = $product->relationLoaded('bomItems')
            ? $product->bomItems
            : $product->bomItems()->with('component')->get();

        foreach ($items as $row) {
            $component = $row->component;
            if (! $component || ! $component->track_stock) {
                continue;
            }

            $qty = (int) round((float) $row->qty * $soldQty);
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
        $warehouse = $inventory->resolveDefaultWarehouse((int) $sale->company_id, (int) $sale->outlet_id);

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
