<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\Choice;
use App\Models\Product;
use App\Models\ProductBomItem;
use App\Models\ProductImage;
use App\Models\StockBalance;
use App\Models\SubCategory;
use App\Models\Unit;
use App\Support\CurrentCompany;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny([
                'products',
                'pos',
                'promotions',
                'discounts',
                'purchaserequisitions',
                'purchaseorders',
                'goodsreceipts',
                'stock',
                'stockcard',
                'stocktransfers',
                'stockopnames',
                'stockadjustments',
                'stockwaste',
                'stockproduction',
            ]);
        } else {
            $this->ensureCanAny([
                'products',
                'pos',
                'purchaserequisitions',
                'purchaseorders',
                'goodsreceipts',
                'stock',
                'stockcard',
                'stocktransfers',
                'stockopnames',
                'stockadjustments',
                'stockwaste',
                'stockproduction',
            ]);
        }
        $query = Product::query()->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            });
        }

        if ($request->filled('barcode')) {
            $query->where('barcode', $request->string('barcode')->toString());
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }

        if ($request->filled('sub_category_id')) {
            $query->where('sub_category_id', $request->integer('sub_category_id'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->string('type')->toString());
        }

        if ($request->boolean('for_pos')) {
            $query->where('sell_price', '>', 0)
                ->where(function ($q) {
                    $q->whereNull('category_id')
                        ->orWhereHas('category', fn ($c) => $c->where('show_pos', true));
                });
        }

        if ($request->boolean('for_purchase')) {
            $query->where(function ($q) {
                $q->where('is_procurement_item', true)
                    ->orWhere('is_fixed_asset_item', true)
                    ->orWhereNull('category_id')
                    ->orWhereHas('category', fn ($c) => $c->where('is_raw_material', true));
            });
        }

        $supplierIdForCost = $request->integer('supplier_id') ?: null;
        $preferredVendors = app(\App\Services\PreferredVendorService::class);
        $supplierPrices = app(\App\Services\SupplierProductPriceService::class);

        if ($request->boolean('for_select')) {
            $this->applyActiveStatus($query, $request);
            $items = $query
                ->with(['productUnits.unitMaster', 'unitMaster', 'category:id,preferred_supplier_id'])
                ->withCount('bomItems')
                ->limit(500)
                ->get();

            $units = app(\App\Services\ProductUnitService::class);

            return $this->ok($items->map(function (Product $product) use ($units, $preferredVendors, $supplierPrices, $supplierIdForCost) {
                $resolvedPreferred = $preferredVendors->resolveForProduct($product);
                $payload = [
                    'id' => $product->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'barcode' => $product->barcode,
                    'unit' => $product->unit,
                    'unit_id' => $product->unit_id,
                    'is_active' => $product->is_active,
                    'track_stock' => (bool) $product->track_stock,
                    'has_bom' => (int) ($product->bom_items_count ?? 0) > 0,
                    'is_procurement_item' => (bool) $product->is_procurement_item,
                    'is_fixed_asset_item' => (bool) $product->is_fixed_asset_item,
                    'preferred_supplier_id' => $resolvedPreferred,
                    'units' => $units->serialize($product),
                ];

                if ($supplierIdForCost) {
                    $small = collect($units->serialize($product))->firstWhere('level', 'small');
                    $unitCost = $supplierPrices->resolveUnitCost(
                        $supplierIdForCost,
                        (int) $product->id,
                        $small['level'] ?? 'small',
                        $small['unit'] ?? null,
                    );
                    if ($unitCost !== null && $unitCost > 0) {
                        $payload['suggested_unit_cost'] = $unitCost;
                    }
                }

                return $payload;
            })->values());
        }

        $query->with($this->listRelations())->withCount('bomItems');
        $this->applyActiveStatus($query, $request, true);

        $companyId = (int) CurrentCompany::id();
        $outlet = CurrentCompany::outlet();
        $canCachePos = $request->boolean('for_pos')
            && ! $request->filled('search')
            && ! $request->filled('barcode')
            && ! $request->boolean('for_select')
            && ! $request->boolean('for_purchase');
        $perPage = $this->perPage($request, 50);
        $pageNum = max(1, $request->integer('page', 1));

        if ($canCachePos && $companyId) {
            $suffix = ($outlet?->id ?? 0).':p'.$pageNum.':pp'.$perPage;
            $cached = TenantCache::rememberVersioned($companyId, 'pos_catalog', $suffix, 300, function () use ($query, $request, $outlet, $perPage) {
                return $this->buildProductPage($query, $request, $outlet, $perPage);
            });

            return $this->ok($cached['items'], $cached['meta']);
        }

        $page = $this->buildProductPage($query, $request, $outlet, $perPage);

        return $this->ok($page['items'], $page['meta']);
    }

    /**
     * @return array{items: list<mixed>, meta: array<string, int>}
     */
    private function buildProductPage($query, Request $request, ?Outlet $outlet, int $perPage): array
    {
        $products = (clone $query)->paginate($perPage);
        $ids = $products->getCollection()->pluck('id');
        $balances = collect();
        if ($outlet && $ids->isNotEmpty()) {
            $warehouse = app(\App\Services\InventoryService::class)
                ->resolveDefaultWarehouse((int) $outlet->company_id, (int) $outlet->id);
            $balances = StockBalance::query()
                ->where('warehouse_id', $warehouse->id)
                ->whereIn('product_id', $ids)
                ->pluck('qty', 'product_id');
        }

        $items = $products->getCollection()
            ->map(fn (Product $product) => $this->serializeList($product, (int) ($balances[$product->id] ?? 0)))
            ->values()
            ->all();

        return [
            'items' => $items,
            'meta' => $this->pageMeta($products),
        ];
    }

    private function invalidatePosCatalog(?int $companyId = null): void
    {
        $companyId ??= CurrentCompany::id();
        if ($companyId) {
            TenantCache::bump((int) $companyId, 'pos_catalog');
        }
    }

    public function show(Product $product): JsonResponse
    {
        $this->ensureCanAny(['products', 'pos']);
        $qty = $this->qty($product);

        return $this->ok($this->serialize($this->withRelations($product), $qty));
    }

    public function barcode(string $code): JsonResponse
    {
        $this->ensureCanAny([
            'products',
            'pos',
            'stock',
            'stockcard',
            'stocktransfers',
            'stockopnames',
            'stockadjustments',
            'stockwaste',
            'stockproduction',
        ]);
        $product = Product::query()
            ->with($this->relationList())
            ->where('is_active', true)
            ->where(function ($query) use ($code) {
                $query->where('barcode', $code)->orWhere('sku', $code);
            })
            ->first();

        if (! $product) {
            return $this->error('Produk tidak ditemukan.', [], 404);
        }

        return $this->ok($this->serialize($product, $this->qty($product)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('products', 'create');

        [$data, $outletPrices, $choiceIds, $bomItems, $channelPrices, $productUnits] = $this->validated($request);
        $initialQty = (int) $request->integer('initial_qty', 0);

        $product = DB::transaction(function () use ($data, $outletPrices, $choiceIds, $bomItems, $channelPrices, $productUnits, $initialQty) {
            $product = Product::query()->create($data);
            $this->syncOutletPrices($product, $outletPrices);
            $this->syncChannelPrices($product, $channelPrices);
            $this->syncChoices($product, $choiceIds);
            $this->syncBom($product, $bomItems);
            app(\App\Services\ProductUnitService::class)->sync($product, $productUnits);
            $this->ensureBalance($product, $initialQty, 'opening');

            return $product;
        });

        $this->invalidatePosCatalog();

        return $this->ok($this->serialize($this->withRelations($product), $this->qty($product)), [], 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->ensureCan('products', 'edit');

        [$data, $outletPrices, $choiceIds, $bomItems, $channelPrices, $productUnits] = $this->validated($request, $product->id);

        $product = DB::transaction(function () use ($product, $data, $outletPrices, $choiceIds, $bomItems, $channelPrices, $productUnits) {
            $product->update($data);
            $this->syncOutletPrices($product, $outletPrices);
            $this->syncChannelPrices($product, $channelPrices);
            $this->syncChoices($product, $choiceIds);
            $this->syncBom($product, $bomItems);
            app(\App\Services\ProductUnitService::class)->sync($product, $productUnits);

            return $product;
        });

        $this->ensurePrimary($product);
        $this->invalidatePosCatalog();

        return $this->ok($this->serialize($this->withRelations($product), $this->qty($product)));
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->ensureCanAny([['products', 'delete'], ['products', 'edit']]);
        $product->update(['is_active' => false]);
        $this->invalidatePosCatalog();

        return $this->ok($this->serialize($this->withRelations($product), $this->qty($product)));
    }

    public function storeImages(Request $request, Product $product): JsonResponse
    {
        $this->ensureCanAny([['products', 'create'], ['products', 'edit']]);

        $request->validate([
            'images' => ['required', 'array', 'max:8'],
            'images.*' => ['required', 'file', 'image', 'max:4096'],
        ]);

        $files = $request->file('images', []);
        if ($files instanceof UploadedFile) {
            $files = [$files];
        }
        $files = array_values(array_filter(is_array($files) ? $files : []));
        $existing = $product->images()->count();
        if ($existing + count($files) > 8) {
            throw ValidationException::withMessages([
                'images' => ['Maksimal 8 foto produk.'],
            ]);
        }

        $hadPrimary = $product->images()->where('is_primary', true)->exists();
        $primaryIndex = $request->has('primary_index') ? $request->integer('primary_index') : -1;

        $sort = (int) $product->images()->max('sort_order');
        foreach ($files as $i => $file) {
            $path = $this->storeImageFile($product, $file);
            $sort++;
            $makePrimary = $primaryIndex === $i || ($primaryIndex < 0 && ! $hadPrimary && $i === 0);
            if ($makePrimary) {
                $product->images()->update(['is_primary' => false]);
                $hadPrimary = true;
            }
            $product->images()->create([
                'path' => $path,
                'sort_order' => $sort,
                'is_primary' => $makePrimary,
            ]);
        }

        $this->ensurePrimary($product);

        return $this->ok($this->serialize($this->withRelations($product), $this->qty($product)));
    }

    public function setPrimary(Product $product, ProductImage $productImage): JsonResponse
    {
        $this->ensureCanAny([['products', 'create'], ['products', 'edit']]);
        abort_unless($productImage->product_id === $product->id, 404);

        $this->markPrimary($product, $productImage);

        return $this->ok($this->serialize($this->withRelations($product), $this->qty($product)));
    }

    public function destroyImage(Product $product, ProductImage $productImage): JsonResponse
    {
        $this->ensureCanAny([['products', 'edit'], ['products', 'delete']]);
        abort_unless($productImage->product_id === $product->id, 404);

        $file = $productImage->absolutePath();
        $productImage->delete();
        if (is_file($file)) {
            @unlink($file);
        }

        $this->ensurePrimary($product);

        return $this->ok($this->serialize($this->withRelations($product), $this->qty($product)));
    }

    private function markPrimary(Product $product, ProductImage $image): void
    {
        $product->images()->update(['is_primary' => false]);
        $image->update(['is_primary' => true, 'sort_order' => 0]);
    }

    private function ensurePrimary(Product $product): void
    {
        if ($product->images()->where('is_primary', true)->exists()) {
            return;
        }

        $next = $product->images()->reorder()->orderBy('sort_order')->orderBy('id')->first();
        $next?->update(['is_primary' => true]);
    }

    /**
     * @return array{0: array<string, mixed>, 1: list<array{outlet_id: int, sell_price: int}>|null, 2: list<int>|null, 3: list<array{component_id: int, qty: float, unit_id: int|null}>|null}
     */
    private function validated(Request $request, ?int $id = null): array
    {
        $companyId = CurrentCompany::id();

        $data = $request->validate([
            'name' => [$id ? 'sometimes' : 'required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:5000'],
            'type' => ['sometimes', Rule::in(['goods', 'service'])],
            'category_id' => [
                'nullable',
                'integer',
                Rule::exists('categories', 'id')->where('company_id', $companyId),
            ],
            'sub_category_id' => [
                'nullable',
                'integer',
                Rule::exists('sub_categories', 'id')->where('company_id', $companyId),
            ],
            'item_type_id' => [
                'nullable',
                'integer',
                Rule::exists('item_types', 'id')->where('company_id', $companyId),
            ],
            'sku' => ['nullable', 'string', 'max:50', Rule::unique('products', 'sku')->where(fn ($q) => $q->where('company_id', $companyId))->ignore($id)],
            'barcode' => ['nullable', 'string', 'max:80'],
            'unit_id' => [
                $id ? 'sometimes' : 'required_without:units',
                'nullable',
                'integer',
                Rule::exists('units', 'id')->where('company_id', $companyId),
            ],
            'units' => ['nullable', 'array', 'max:3'],
            'units.*.level' => ['required_with:units', Rule::in(['small', 'medium', 'large'])],
            'units.*.unit_id' => [
                'required_with:units',
                'integer',
                Rule::exists('units', 'id')->where('company_id', $companyId),
            ],
            'units.*.factor_to_base' => ['nullable', 'integer', 'min:1'],
            'sell_price' => [$id ? 'sometimes' : 'required', 'integer', 'min:0'],
            'outlet_prices' => ['nullable', 'array'],
            'outlet_prices.*.outlet_id' => [
                'required',
                'integer',
                Rule::exists('outlets', 'id')->where('company_id', $companyId),
            ],
            'outlet_prices.*.sell_price' => ['required', 'integer', 'min:0'],
            'channel_prices' => ['nullable', 'array'],
            'channel_prices.*.price_channel_id' => [
                'required',
                'integer',
                Rule::exists('price_channels', 'id')->where('company_id', $companyId),
            ],
            'channel_prices.*.sell_price' => ['required', 'integer', 'min:0'],
            'track_stock' => ['sometimes', 'boolean'],
            'is_procurement_item' => ['sometimes', 'boolean'],
            'is_fixed_asset_item' => ['sometimes', 'boolean'],
            'preferred_supplier_id' => ['nullable', 'integer'],
            'min_stock' => ['sometimes', 'integer', 'min:0'],
            'max_stock' => ['sometimes', 'integer', 'min:0'],
            'reorder_qty' => ['sometimes', 'integer', 'min:0'],
            'custom_fields' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'choice_ids' => ['nullable', 'array'],
            'choice_ids.*' => [
                'integer',
                Rule::exists('choices', 'id')->where('company_id', $companyId),
            ],
            'bom_items' => ['nullable', 'array'],
            'bom_items.*.component_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')->where('company_id', $companyId),
            ],
            'bom_items.*.qty' => ['required', 'numeric', 'gt:0'],
            'bom_items.*.unit_id' => [
                'nullable',
                'integer',
                Rule::exists('units', 'id')->where('company_id', $companyId),
            ],
        ]);

        if (array_key_exists('sku', $data)) {
            $data['sku'] = $data['sku'] !== '' && $data['sku'] !== null ? $data['sku'] : null;
        }

        if (array_key_exists('barcode', $data)) {
            $data['barcode'] = $data['barcode'] !== '' && $data['barcode'] !== null ? $data['barcode'] : null;
        }

        if (array_key_exists('description', $data)) {
            $data['description'] = $data['description'] !== '' && $data['description'] !== null ? $data['description'] : null;
        }

        if (($data['type'] ?? null) === 'service') {
            $data['track_stock'] = false;
        }

        if (! empty($data['is_fixed_asset_item'])) {
            $data['track_stock'] = false;
            $data['is_procurement_item'] = false;
        } elseif (! empty($data['is_procurement_item'])) {
            $data['track_stock'] = false;
            $data['is_fixed_asset_item'] = false;
        }

        if (array_key_exists('preferred_supplier_id', $data)) {
            app(\App\Services\PreferredVendorService::class)
                ->assertSupplier($data['preferred_supplier_id'] ? (int) $data['preferred_supplier_id'] : null);
            if (! $data['preferred_supplier_id']) {
                $data['preferred_supplier_id'] = null;
            }
        }

        if (array_key_exists('sub_category_id', $data) && $data['sub_category_id']) {
            $sub = SubCategory::query()->find($data['sub_category_id']);
            $categoryId = $data['category_id'] ?? ($id ? Product::query()->find($id)?->category_id : null);
            if (! $sub || (int) $sub->category_id !== (int) $categoryId) {
                throw ValidationException::withMessages([
                    'sub_category_id' => ['Sub kategori harus sesuai kategori yang dipilih.'],
                ]);
            }
        }

        if (array_key_exists('item_type_id', $data) && ! $data['item_type_id']) {
            $data['item_type_id'] = null;
        }

        if (array_key_exists('unit_id', $data) && ! array_key_exists('units', $data)) {
            if ($data['unit_id']) {
                $unit = Unit::query()->find($data['unit_id']);
                $data['unit'] = $unit?->symbol ?: ($unit?->name ?: 'pcs');
            } else {
                $data['unit_id'] = null;
            }
        }

        $productUnits = null;
        if (array_key_exists('units', $data)) {
            $productUnits = array_values($data['units'] ?? []);
            unset($data['units']);

            $small = collect($productUnits)->firstWhere('level', 'small');
            if ($small && ! empty($small['unit_id'])) {
                $unit = Unit::query()->find($small['unit_id']);
                $data['unit_id'] = (int) $small['unit_id'];
                $data['unit'] = $unit?->symbol ?: ($unit?->name ?: 'pcs');
            }
        } elseif (! $id && ! empty($data['unit_id'])) {
            $productUnits = [[
                'level' => 'small',
                'unit_id' => (int) $data['unit_id'],
                'factor_to_base' => 1,
            ]];
        }

        $outletPrices = null;
        if (array_key_exists('outlet_prices', $data)) {
            $outletPrices = array_map(fn (array $row) => [
                'outlet_id' => (int) $row['outlet_id'],
                'sell_price' => (int) $row['sell_price'],
            ], $data['outlet_prices'] ?? []);
            unset($data['outlet_prices']);

            if ($outletPrices !== [] && ! array_key_exists('sell_price', $data)) {
                $defaultOutletId = Outlet::query()->where('is_default', true)->value('id');
                $picked = collect($outletPrices)->firstWhere('outlet_id', $defaultOutletId) ?? $outletPrices[0];
                $data['sell_price'] = $picked['sell_price'];
            }
        }

        $choiceIds = array_key_exists('choice_ids', $data)
            ? array_values($data['choice_ids'] ?? [])
            : ($id ? null : []);
        unset($data['choice_ids']);

        $bomItems = null;
        if (array_key_exists('bom_items', $data)) {
            $bomItems = [];
            foreach ($data['bom_items'] ?? [] as $row) {
                $bomItems[] = [
                    'component_id' => (int) $row['component_id'],
                    'qty' => (float) $row['qty'],
                    'unit_id' => isset($row['unit_id']) && $row['unit_id'] ? (int) $row['unit_id'] : null,
                ];
            }
            $this->assertBomValid($id, $bomItems);
        } elseif (! $id) {
            $bomItems = [];
        }
        unset($data['bom_items']);

        $channelPrices = null;
        if (array_key_exists('channel_prices', $data)) {
            $channelPrices = array_map(fn (array $row) => [
                'price_channel_id' => (int) $row['price_channel_id'],
                'sell_price' => (int) $row['sell_price'],
            ], $data['channel_prices'] ?? []);
        } elseif (! $id) {
            $channelPrices = [];
        }
        unset($data['channel_prices']);

        if (array_key_exists('custom_fields', $data) || ! $id) {
            $data['custom_fields'] = app(\App\Services\CustomFieldService::class)
                ->normalize('product', $data['custom_fields'] ?? []);
        }

        return [$data, $outletPrices, $choiceIds, $bomItems, $channelPrices, $productUnits];
    }

    /**
     * @param  list<array{component_id: int, qty: float, unit_id: int|null}>  $rows
     */
    private function assertBomValid(?int $productId, array $rows): void
    {
        $ids = array_column($rows, 'component_id');
        if (count($ids) !== count(array_unique($ids))) {
            throw ValidationException::withMessages([
                'bom_items' => ['Komponen tidak boleh dobel.'],
            ]);
        }

        foreach ($rows as $row) {
            if ($productId && $row['component_id'] === $productId) {
                throw ValidationException::withMessages([
                    'bom_items' => ['Produk tidak bisa memakai dirinya sendiri sebagai bahan.'],
                ]);
            }

            if ($productId && $this->bomReaches($row['component_id'], $productId, [])) {
                throw ValidationException::withMessages([
                    'bom_items' => ['BOM membentuk siklus. Pilih komponen lain.'],
                ]);
            }
        }
    }

    /**
     * @param  array<int, true>  $seen
     */
    private function bomReaches(int $fromProductId, int $targetId, array $seen): bool
    {
        if ($fromProductId === $targetId) {
            return true;
        }

        if (isset($seen[$fromProductId])) {
            return false;
        }

        $seen[$fromProductId] = true;
        $childIds = ProductBomItem::query()->where('product_id', $fromProductId)->pluck('component_id');
        foreach ($childIds as $childId) {
            if ($this->bomReaches((int) $childId, $targetId, $seen)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<int>|null  $choiceIds
     */
    private function syncChoices(Product $product, ?array $choiceIds): void
    {
        if ($choiceIds === null) {
            return;
        }

        $ids = Choice::query()->whereIn('id', $choiceIds ?: [0])->pluck('id')->all();
        $product->choices()->sync($ids);
    }

    /**
     * @param  list<array{component_id: int, qty: float, unit_id: int|null}>|null  $rows
     */
    private function syncBom(Product $product, ?array $rows): void
    {
        if ($rows === null) {
            return;
        }

        $keep = [];
        foreach ($rows as $i => $row) {
            if ($row['component_id'] === (int) $product->id) {
                throw ValidationException::withMessages([
                    'bom_items' => ['Produk tidak bisa memakai dirinya sendiri sebagai bahan.'],
                ]);
            }

            $item = $product->bomItems()->updateOrCreate(
                ['component_id' => $row['component_id']],
                [
                    'company_id' => $product->company_id,
                    'qty' => $row['qty'],
                    'unit_id' => $row['unit_id'],
                    'sort_order' => $i,
                ],
            );
            $keep[] = $item->id;
        }

        $product->bomItems()->whereNotIn('id', $keep ?: [0])->delete();
    }

    /**
     * @param  list<array{outlet_id: int, sell_price: int}>|null  $rows
     */
    private function syncOutletPrices(Product $product, ?array $rows): void
    {
        if ($rows === null) {
            return;
        }

        $keep = [];
        foreach ($rows as $row) {
            $item = $product->outletPrices()->updateOrCreate(
                ['outlet_id' => $row['outlet_id']],
                ['sell_price' => $row['sell_price']],
            );
            $keep[] = $item->id;
        }

        $product->outletPrices()->whereNotIn('id', $keep ?: [0])->delete();
    }

    /**
     * @param  list<array{price_channel_id: int, sell_price: int}>|null  $rows
     */
    private function syncChannelPrices(Product $product, ?array $rows): void
    {
        if ($rows === null) {
            return;
        }

        $keep = [];
        foreach ($rows as $row) {
            $item = $product->channelPrices()->updateOrCreate(
                ['price_channel_id' => $row['price_channel_id']],
                [
                    'company_id' => $product->company_id,
                    'sell_price' => $row['sell_price'],
                ],
            );
            $keep[] = $item->id;
        }

        $product->channelPrices()->whereNotIn('id', $keep ?: [0])->delete();
    }

    private function storeImageFile(Product $product, UploadedFile $uploaded): string
    {
        abort_unless($uploaded->isValid(), 422, 'Unggahan foto gagal.');

        $info = @getimagesize($uploaded->getRealPath() ?: $uploaded->getPathname());
        abort_unless($info !== false, 422, 'File bukan gambar yang valid.');

        $ext = match ($info[2] ?? 0) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        };
        abort_unless($ext, 422, 'Format gambar tidak didukung. Pakai JPG, PNG, atau WebP.');

        $dir = storage_path('app/public/products');
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder foto produk.');
        }

        $name = $product->id.'_'.Str::uuid().'.'.$ext;
        $uploaded->move($dir, $name);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$name), 422, 'Tidak bisa menyimpan foto.');

        return 'products/'.$name;
    }

    /**
     * @return list<string|\Closure>
     */
    private function listRelations(): array
    {
        return [
            'category:id,name',
            'subCategory:id,name,category_id',
            'outletPrices:id,product_id,outlet_id,sell_price',
            'channelPrices.priceChannel:id,name,code',
            'images' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id')->limit(1),
            'choices.choiceType:id,name',
            'productUnits.unitMaster:id,name,symbol',
            'unitMaster:id,name,symbol',
        ];
    }

    /**
     * @return list<string>
     */
    private function relationList(): array
    {
        return ['category', 'subCategory', 'itemType', 'unitMaster', 'productUnits.unitMaster', 'images', 'outletPrices', 'channelPrices.priceChannel', 'choices.choiceType', 'bomItems.component', 'bomItems.unitMaster', 'preferredSupplier:id,name'];
    }

    private function withRelations(Product $product): Product
    {
        return $product->fresh($this->relationList()) ?? $product;
    }

    private function ensureBalance(Product $product, int $initialQty, string $note): void
    {
        if (! $product->track_stock) {
            return;
        }

        $outlet = CurrentCompany::outlet();
        if (! $outlet) {
            return;
        }

        $inventory = app(\App\Services\InventoryService::class);
        $warehouse = $inventory->resolveDefaultWarehouse((int) $product->company_id, (int) $outlet->id);

        if ($initialQty === 0) {
            return;
        }

        $inventory->adjust(
            (int) $product->company_id,
            (int) $warehouse->id,
            (int) $product->id,
            $initialQty,
            'adjustment',
            'product',
            (int) $product->id,
            $note,
            (int) $outlet->id,
            null,
            (int) $product->cost_price,
        );
    }

    private function qty(Product $product): int
    {
        $outlet = CurrentCompany::outlet();

        if (! $outlet || ! $product->track_stock) {
            return 0;
        }

        return app(\App\Services\InventoryService::class)->qtyAtOutletDefault(
            (int) $product->company_id,
            (int) $outlet->id,
            (int) $product->id,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeList(Product $product, int $qty): array
    {
        $outletId = CurrentCompany::outlet()?->id;
        $cover = $product->relationLoaded('images') ? $product->images->first() : null;

        return [
            'id' => $product->id,
            'category_id' => $product->category_id,
            'category' => $product->category?->only(['id', 'name']),
            'sub_category_id' => $product->sub_category_id,
            'sub_category' => $product->subCategory?->only(['id', 'name', 'category_id']),
            'name' => $product->name,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'unit' => $product->unit,
            'unit_id' => $product->unit_id,
            'units' => app(\App\Services\ProductUnitService::class)->serialize($product),
            'sell_price' => $product->priceFor($outletId),
            'images' => $cover && $cover->url()
                ? [[
                    'id' => (int) $cover->id,
                    'url' => $cover->url(),
                    'sort_order' => (int) $cover->sort_order,
                    'is_primary' => true,
                ]]
                : [],
            'min_stock' => $product->min_stock,
            'max_stock' => (int) ($product->max_stock ?? 0),
            'reorder_qty' => (int) ($product->reorder_qty ?? 0),
            'is_procurement_item' => (bool) $product->is_procurement_item,
            'is_fixed_asset_item' => (bool) $product->is_fixed_asset_item,
            'is_active' => $product->is_active,
            'stock_qty' => $qty,
            'has_bom' => (int) ($product->bom_items_count ?? 0) > 0,
            'choice_types' => $this->serializeListChoiceTypes($product),
            'channel_prices' => $this->serializeChannelPrices($product),
        ];
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function serializeListChoiceTypes(Product $product): array
    {
        if (! $product->relationLoaded('choices')) {
            return [];
        }

        return $product->choices
            ->groupBy('choice_type_id')
            ->map(function ($items) {
                $type = $items->first()?->choiceType;
                if (! $type) {
                    return null;
                }

                return [
                    'id' => (int) $type->id,
                    'name' => $type->name,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return list<array{price_channel_id: int, sell_price: int, name: string|null, code: string|null}>
     */
    private function serializeChannelPrices(Product $product): array
    {
        if (! $product->relationLoaded('channelPrices')) {
            return [];
        }

        return $product->channelPrices
            ->map(fn ($row) => [
                'price_channel_id' => (int) $row->price_channel_id,
                'sell_price' => (int) $row->sell_price,
                'name' => $row->priceChannel?->name,
                'code' => $row->priceChannel?->code,
            ])
            ->values()
            ->all();
    }

    private function serialize(Product $product, int $qty): array
    {
        $outletId = CurrentCompany::outlet()?->id;

        return [
            'id' => $product->id,
            'category_id' => $product->category_id,
            'category' => $product->category?->only(['id', 'name']),
            'sub_category_id' => $product->sub_category_id,
            'sub_category' => $product->subCategory?->only(['id', 'name', 'category_id']),
            'item_type_id' => $product->item_type_id,
            'item_type' => $product->itemType?->only(['id', 'name']),
            'type' => $product->type,
            'name' => $product->name,
            'description' => $product->description,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'unit' => $product->unit,
            'unit_id' => $product->unit_id,
            'unit_master' => $product->unitMaster?->only(['id', 'name', 'symbol']),
            'units' => app(\App\Services\ProductUnitService::class)->serialize($product),
            'sell_price' => $product->priceFor($outletId),
            'default_sell_price' => (int) $product->sell_price,
            'outlet_prices' => $product->outletPrices
                ->map(fn ($row) => [
                    'outlet_id' => (int) $row->outlet_id,
                    'sell_price' => (int) $row->sell_price,
                ])
                ->values(),
            'channel_prices' => $this->serializeChannelPrices($product),
            'images' => $product->images
                ->map(fn (ProductImage $image) => [
                    'id' => $image->id,
                    'url' => $image->url(),
                    'sort_order' => $image->sort_order,
                    'is_primary' => (bool) $image->is_primary,
                ])
                ->filter(fn (array $row) => $row['url'])
                ->values(),
            'track_stock' => $product->track_stock,
            'is_procurement_item' => (bool) $product->is_procurement_item,
            'is_fixed_asset_item' => (bool) $product->is_fixed_asset_item,
            'preferred_supplier_id' => $product->preferred_supplier_id
                ? (int) $product->preferred_supplier_id
                : app(\App\Services\PreferredVendorService::class)->resolveForProduct($product),
            'preferred_supplier' => $product->preferredSupplier?->only(['id', 'name']),
            'min_stock' => $product->min_stock,
            'max_stock' => (int) ($product->max_stock ?? 0),
            'reorder_qty' => (int) ($product->reorder_qty ?? 0),
            'custom_fields' => $product->custom_fields,
            'is_active' => $product->is_active,
            'stock_qty' => $qty,
            'choice_ids' => $this->choiceIds($product),
            'choice_types' => $this->choiceGroups($product),
            'bom_items' => $this->serializeBom($product),
        ];
    }

    /**
     * @return list<array{id: int, component_id: int, component: array{id: int, name: string, sku: string|null, unit: string, unit_id: int|null}|null, qty: float, unit_id: int|null, unit: array{id: int, name: string, symbol: string|null}|null, sort_order: int}>
     */
    private function serializeBom(Product $product): array
    {
        $rows = $product->relationLoaded('bomItems')
            ? $product->bomItems
            : $product->bomItems()->with(['component', 'unitMaster'])->get();

        return $rows
            ->map(function (ProductBomItem $row) {
                return [
                    'id' => (int) $row->id,
                    'component_id' => (int) $row->component_id,
                    'component' => $row->component ? [
                        'id' => (int) $row->component->id,
                        'name' => $row->component->name,
                        'sku' => $row->component->sku,
                        'unit' => $row->component->unit,
                        'unit_id' => $row->component->unit_id ? (int) $row->component->unit_id : null,
                    ] : null,
                    'qty' => (float) $row->qty,
                    'unit_id' => $row->unit_id ? (int) $row->unit_id : null,
                    'unit' => $row->unitMaster?->only(['id', 'name', 'symbol']),
                    'sort_order' => (int) $row->sort_order,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<int>
     */
    private function choiceIds(Product $product): array
    {
        if ($product->relationLoaded('choices')) {
            return $product->choices->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        }

        return $product->choices()->pluck('choices.id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * @return list<array{id: int, name: string, is_required: bool, min_select: int, max_select: int, choices: list<array{id: int, name: string, extra_price: int}>}>
     */
    private function choiceGroups(Product $product): array
    {
        $choices = $product->relationLoaded('choices')
            ? $product->choices
            : $product->choices()->with('choiceType')->get();

        return $choices
            ->groupBy('choice_type_id')
            ->map(function ($items) {
                $type = $items->first()?->choiceType;
                if (! $type) {
                    return null;
                }

                return [
                    'id' => (int) $type->id,
                    'name' => $type->name,
                    'is_required' => (bool) $type->is_required,
                    'min_select' => (int) $type->min_select,
                    'max_select' => (int) $type->max_select,
                    'choices' => $items
                        ->sortBy([['sort_order', 'asc'], ['name', 'asc']])
                        ->map(fn ($choice) => [
                            'id' => (int) $choice->id,
                            'name' => $choice->name,
                            'extra_price' => (int) $choice->extra_price,
                        ])
                        ->values()
                        ->all(),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}
