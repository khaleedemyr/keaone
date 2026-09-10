<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StorefrontDomain;
use App\Models\StorefrontOrder;
use App\Models\StorefrontProduct;
use App\Services\StorefrontDomainService;
use App\Services\StorefrontService;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StorefrontController extends Controller
{
    public function show(StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCanAny(['storefrontsetup', 'storefrontdomain', 'storefrontproducts', 'storefrontorders', 'storefrontpages']);

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $storefront = $storefronts->forCompany($company);

        return $this->ok($storefronts->toAdminArray($storefront));
    }

    public function update(Request $request, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontsetup', 'edit');

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $storefront = $storefronts->forCompany($company);

        $data = $request->validate([
            'site_kind' => ['sometimes', Rule::in(['landing', 'shop'])],
            'template_key' => ['sometimes', 'string', 'max:60'],
            'status' => ['sometimes', Rule::in(['draft', 'published', 'suspended'])],
            'title' => ['nullable', 'string', 'max:160'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'about' => ['nullable', 'string'],
            'brand_colors' => ['nullable', 'array'],
            'brand_colors.primary' => ['nullable', 'string', 'max:32'],
            'brand_colors.accent' => ['nullable', 'string', 'max:32'],
            'brand_colors.background' => ['nullable', 'string', 'max:32'],
            'brand_colors.text' => ['nullable', 'string', 'max:32'],
            'theme_content' => ['nullable', 'array'],
            'apply_preset' => ['sometimes', 'boolean'],
            'bank_accounts' => ['nullable', 'array'],
            'bank_accounts.*.bank_name' => ['required_with:bank_accounts', 'string', 'max:80'],
            'bank_accounts.*.account_name' => ['required_with:bank_accounts', 'string', 'max:120'],
            'bank_accounts.*.account_number' => ['required_with:bank_accounts', 'string', 'max:60'],
            'shipping' => ['nullable', 'array'],
            'shipping.enabled' => ['sometimes', 'boolean'],
            'shipping.origin_id' => ['nullable', 'integer', 'min:1'],
            'shipping.origin_label' => ['nullable', 'string', 'max:255'],
            'shipping.couriers' => ['nullable'],
            'shipping.default_weight_gram' => ['nullable', 'integer', 'min:1', 'max:30000'],
            'stock_mode' => ['sometimes', Rule::in(['realtime', 'allocated'])],
            'outlet_id' => ['nullable', 'integer', Rule::exists('outlets', 'id')->where('company_id', $company->id)],
            'warehouse_id' => ['nullable', 'integer', Rule::exists('warehouses', 'id')->where('company_id', $company->id)],
            'price_channel_id' => ['nullable', 'integer', Rule::exists('price_channels', 'id')->where('company_id', $company->id)],
            'contact_email' => ['nullable', 'email', 'max:160'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
            'contact_address' => ['nullable', 'string'],
            'seo_title' => ['nullable', 'string', 'max:160'],
            'seo_description' => ['nullable', 'string'],
        ]);

        return $this->ok($storefronts->toAdminArray($storefronts->update($storefront, $data)));
    }

    public function showHomePage(StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCanAny(['storefrontpages', 'storefrontsetup']);

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $storefront = $storefronts->forCompany($company);
        $page = $storefronts->homePage($storefront);

        return $this->ok($storefronts->toHomePageArray($storefront, $page));
    }

    public function updateHomePage(Request $request, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCanAny([['storefrontpages', 'edit'], ['storefrontsetup', 'edit']]);

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $storefront = $storefronts->forCompany($company);

        $data = $request->validate([
            'blocks' => ['sometimes', 'array', 'max:40'],
            'theme_content' => ['sometimes', 'nullable', 'array'],
            'brand_colors' => ['nullable', 'array'],
            'brand_colors.primary' => ['nullable', 'string', 'max:32'],
            'brand_colors.accent' => ['nullable', 'string', 'max:32'],
            'brand_colors.background' => ['nullable', 'string', 'max:32'],
            'brand_colors.text' => ['nullable', 'string', 'max:32'],
        ]);

        if (! array_key_exists('blocks', $data) && ! array_key_exists('theme_content', $data) && ! array_key_exists('brand_colors', $data)) {
            throw ValidationException::withMessages([
                'blocks' => 'Tidak ada perubahan untuk disimpan.',
            ]);
        }

        $patch = [];
        if (array_key_exists('brand_colors', $data)) {
            $patch['brand_colors'] = $data['brand_colors'];
        }
        if (array_key_exists('theme_content', $data)) {
            $patch['theme_content'] = $data['theme_content'];
            $patch['apply_preset'] = false;
        }
        if ($patch !== []) {
            $storefronts->update($storefront, $patch);
            $storefront = $storefront->fresh();
        }

        if (array_key_exists('blocks', $data)) {
            $page = $storefronts->updateHomeBlocks($storefront, $data['blocks']);
        } else {
            $page = $storefronts->homePage($storefront);
        }

        return $this->ok($storefronts->toHomePageArray($storefront, $page));
    }

    public function applyHomePreset(StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCanAny([['storefrontpages', 'edit'], ['storefrontsetup', 'edit']]);

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $storefront = $storefronts->forCompany($company);
        $page = $storefronts->applyHomePreset($storefront);

        return $this->ok($storefronts->toHomePageArray($storefront, $page));
    }

    public function storeMedia(Request $request, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCanAny([['storefrontsetup', 'edit'], ['storefrontpages', 'edit']]);

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $request->validate([
            'file' => ['required', 'file', 'image', 'max:5120'],
        ]);

        $storefront = $storefronts->forCompany($company);
        $media = $storefronts->storeMedia($storefront, $request->file('file'));

        return $this->ok($media, [], 201);
    }

    public function storeLogo(Request $request, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontsetup', 'edit');

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $request->validate([
            'file' => ['required', 'file', 'image', 'max:4096'],
        ]);

        $storefront = $storefronts->forCompany($company);
        $storefronts->storeLogo($storefront, $request->file('file'));

        return $this->ok($storefronts->toAdminArray($storefront->fresh()));
    }

    public function destroyLogo(StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontsetup', 'edit');

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $storefront = $storefronts->forCompany($company);
        $storefronts->destroyLogo($storefront);

        return $this->ok($storefronts->toAdminArray($storefront->fresh()));
    }

    public function connectDomain(Request $request, StorefrontService $storefronts, StorefrontDomainService $domains): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontdomain', 'create');

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $data = $request->validate([
            'host' => ['required', 'string', 'max:190'],
            'is_primary' => ['sometimes', 'boolean'],
        ]);

        $storefront = $storefronts->forCompany($company);
        $check = $domains->check($storefront, $data['host']);
        if (! $check['can_connect']) {
            return response()->json([
                'message' => $check['message'],
                'errors' => ['host' => [$check['message']]],
                'data' => $check,
            ], 422);
        }

        $domain = $domains->connect($storefront, $data['host'], $data['is_primary'] ?? true);

        return $this->ok($domain, [], 201);
    }

    public function checkDomain(Request $request, StorefrontService $storefronts, StorefrontDomainService $domains): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontdomain', 'view');

        $company = CurrentCompany::company();
        abort_unless($company, 404);

        $data = $request->validate([
            'host' => ['required', 'string', 'max:190'],
        ]);

        $storefront = $storefronts->forCompany($company);

        return $this->ok($domains->check($storefront, $data['host']));
    }

    public function verifyDomain(StorefrontDomain $storefrontDomain, StorefrontDomainService $domains): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontdomain', 'edit');

        return $this->ok($domains->verify($storefrontDomain));
    }

    public function destroyDomain(StorefrontDomain $storefrontDomain): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontdomain', 'delete');

        $storefrontDomain->delete();

        return $this->ok(['deleted' => true]);
    }

    public function products(Request $request, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontproducts', 'view');

        $company = CurrentCompany::company();
        abort_unless($company, 404);
        $storefront = $storefronts->forCompany($company);

        $query = StorefrontProduct::query()
            ->with([
                'product' => fn ($q) => $q->select(['id', 'name', 'sku', 'sell_price', 'is_active', 'track_stock', 'category_id', 'description'])
                    ->with(['images' => fn ($iq) => $iq->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id')]),
            ])
            ->where('storefront_id', $storefront->id)
            ->orderBy('sort_order')
            ->orderBy('id');

        return $this->paged($query, $request, function (StorefrontProduct $row) {
            $product = $row->product;
            $cover = $product?->images?->first();

            return [
                'id' => $row->id,
                'product_id' => $row->product_id,
                'is_visible' => $row->is_visible,
                'sort_order' => $row->sort_order,
                'allocated_qty' => $row->allocated_qty,
                'sold_qty' => $row->sold_qty,
                'override_price' => $row->override_price,
                'is_deal' => (bool) $row->is_deal,
                'is_new_arrival' => (bool) $row->is_new_arrival,
                'is_bestseller' => (bool) $row->is_bestseller,
                'units_sold' => (int) $row->units_sold,
                'avg_rating' => round((float) $row->avg_rating, 2),
                'review_count' => (int) $row->review_count,
                'product' => $product ? [
                    'id' => $product->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'sell_price' => $product->sell_price,
                    'description' => $product->description,
                    'is_active' => $product->is_active,
                    'track_stock' => $product->track_stock,
                    'category_id' => $product->category_id,
                    'image_url' => $cover?->url(),
                ] : null,
            ];
        });
    }

    public function placeOrder(Request $request, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCanAny([['storefrontorders', 'edit'], ['storefrontorders', 'view'], ['storefrontsetup', 'edit']]);

        $company = CurrentCompany::company();
        abort_unless($company, 404);
        $storefront = $storefronts->forCompany($company);

        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:40'],
            'customer_email' => ['nullable', 'email', 'max:120'],
            'customer_address' => ['nullable', 'string', 'max:2000'],
            'note' => ['nullable', 'string', 'max:1000'],
            'client_uuid' => ['required', 'uuid'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer', 'min:1'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:999'],
            'shipping_destination_id' => ['nullable', 'integer', 'min:1'],
            'shipping_destination_label' => ['nullable', 'string', 'max:255'],
            'shipping_courier' => ['nullable', 'string', 'max:40'],
            'shipping_service' => ['nullable', 'string', 'max:40'],
        ]);

        $customer = \App\Http\Middleware\AuthenticateStorefrontCustomer::resolve($request);
        if ($customer && (int) $customer->storefront_id === (int) $storefront->id) {
            $data['contact_id'] = $customer->contact_id;
            if (empty($data['customer_email'])) {
                $data['customer_email'] = $customer->email;
            }
            if (empty($data['customer_phone']) && $customer->phone) {
                $data['customer_phone'] = $customer->phone;
            }
            if (empty($data['customer_address']) && $customer->address) {
                $data['customer_address'] = $customer->address;
            }
        }

        $order = $storefronts->placeOrder($storefront, $data);

        return $this->ok([
            'id' => $order->id,
            'number' => $order->number,
            'status' => $order->status,
            'subtotal' => $order->subtotal,
            'shipping_cost' => $order->shipping_cost,
            'total' => $order->total,
            'customer_address' => $order->customer_address,
            'note' => $order->note,
            'shipping_snapshot' => $order->shipping_snapshot,
            'bank_accounts' => $order->bank_snapshot ?? [],
            'bank_snapshot' => $order->bank_snapshot ?? [],
            'placed_at' => optional($order->placed_at)?->toIso8601String(),
            'items' => $order->items->map(fn ($item) => [
                'product_id' => $item->product_id,
                'name' => $item->name_snapshot,
                'name_snapshot' => $item->name_snapshot,
                'qty' => $item->qty,
                'unit_price' => $item->unit_price,
                'line_total' => $item->line_total,
            ])->values()->all(),
        ], [], 201);
    }

    public function searchShippingDestinations(
        Request $request,
        StorefrontService $storefronts,
        \App\Services\RajaOngkirService $raja,
    ): JsonResponse {
        $this->ensureModule('storefront');
        $this->ensureCanAny(['storefrontsetup', 'storefrontorders']);

        $company = CurrentCompany::company();
        abort_unless($company, 404);
        $storefront = $storefronts->forCompany($company);

        $data = $request->validate([
            'search' => ['required', 'string', 'min:2', 'max:120'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        return $this->ok($raja->searchDestinations($storefront, $data['search'], (int) ($data['limit'] ?? 20)));
    }

    public function calculateShipping(
        Request $request,
        StorefrontService $storefronts,
        \App\Services\RajaOngkirService $raja,
    ): JsonResponse {
        $this->ensureModule('storefront');
        $this->ensureCanAny(['storefrontsetup', 'storefrontorders']);

        $company = CurrentCompany::company();
        abort_unless($company, 404);
        $storefront = $storefronts->forCompany($company);

        $data = $request->validate([
            'destination_id' => ['required', 'integer', 'min:1'],
            'items' => ['nullable', 'array', 'max:50'],
            'items.*.product_id' => ['required_with:items', 'integer', 'min:1'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1', 'max:999'],
            'weight' => ['nullable', 'integer', 'min:1', 'max:30000'],
            'courier' => ['nullable', 'string', 'max:120'],
        ]);

        $weight = isset($data['weight'])
            ? (int) $data['weight']
            : $storefronts->estimateCartWeightGram($storefront, $data['items'] ?? []);

        $couriers = isset($data['courier']) && trim($data['courier']) !== ''
            ? $data['courier']
            : [];

        $options = $raja->calculateDomesticCost($storefront, (int) $data['destination_id'], $weight, $couriers);

        return $this->ok([
            'weight_gram' => $weight,
            'options' => $options,
        ]);
    }

    public function syncProduct(Request $request, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontproducts', 'create');

        $company = CurrentCompany::company();
        abort_unless($company, 404);
        $storefront = $storefronts->forCompany($company);

        $data = $request->validate([
            'product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('company_id', $company->id)],
            'is_visible' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'allocated_qty' => ['nullable', 'integer', 'min:0'],
            'override_price' => ['nullable', 'integer', 'min:0'],
            'is_deal' => ['sometimes', 'boolean'],
            'is_new_arrival' => ['sometimes', 'boolean'],
            'is_bestseller' => ['sometimes', 'boolean'],
        ]);

        $row = StorefrontProduct::query()->updateOrCreate(
            [
                'storefront_id' => $storefront->id,
                'product_id' => $data['product_id'],
            ],
            [
                'company_id' => $company->id,
                'is_visible' => $data['is_visible'] ?? true,
                'sort_order' => $data['sort_order'] ?? 0,
                'allocated_qty' => $data['allocated_qty'] ?? null,
                'override_price' => $data['override_price'] ?? null,
                'is_deal' => $data['is_deal'] ?? false,
                'is_new_arrival' => $data['is_new_arrival'] ?? false,
                'is_bestseller' => $data['is_bestseller'] ?? false,
            ],
        );

        return $this->ok($row->load('product:id,name,sku,sell_price,is_active,track_stock,category_id'));
    }

    public function updateProduct(Request $request, StorefrontProduct $storefrontProduct): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontproducts', 'edit');

        $data = $request->validate([
            'is_visible' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'allocated_qty' => ['nullable', 'integer', 'min:0'],
            'override_price' => ['nullable', 'integer', 'min:0'],
            'is_deal' => ['sometimes', 'boolean'],
            'is_new_arrival' => ['sometimes', 'boolean'],
            'is_bestseller' => ['sometimes', 'boolean'],
        ]);

        $storefrontProduct->update($data);

        return $this->ok($storefrontProduct->fresh()->load('product:id,name,sku,sell_price,is_active,track_stock,category_id'));
    }

    public function destroyProduct(StorefrontProduct $storefrontProduct): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontproducts', 'delete');

        $storefrontProduct->delete();

        return $this->ok(['deleted' => true]);
    }

    public function productOptions(Request $request): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontproducts', 'view');

        $query = Product::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->select(['id', 'name', 'sku', 'sell_price', 'track_stock', 'category_id']);

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            });
        }

        return $this->paged($query, $request);
    }

    public function orders(Request $request, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontorders', 'view');

        $company = CurrentCompany::company();
        abort_unless($company, 404);
        $storefront = $storefronts->forCompany($company);

        $query = StorefrontOrder::query()
            ->with(['items.product:id,name,sku', 'sale:id,number'])
            ->where('storefront_id', $storefront->id)
            ->orderByDesc('placed_at')
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%");
            });
        }

        return $this->paged($query, $request);
    }

    public function confirmOrder(Request $request, StorefrontOrder $storefrontOrder, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontorders', 'edit');

        try {
            $order = $storefronts->confirmOrder($storefrontOrder, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first() ?: 'Order tidak bisa dikonfirmasi.'], 422);
        }

        return $this->ok($order);
    }

    public function shipOrder(StorefrontOrder $storefrontOrder, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontorders', 'edit');

        try {
            $order = $storefronts->markOrderShipped($storefrontOrder);
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first() ?: 'Order tidak bisa dikirim.'], 422);
        }

        return $this->ok($order);
    }

    public function deliverOrder(StorefrontOrder $storefrontOrder, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontorders', 'edit');

        try {
            $order = $storefronts->markOrderDelivered($storefrontOrder);
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first() ?: 'Order tidak bisa ditandai diterima.'], 422);
        }

        return $this->ok($order);
    }

    public function cancelOrder(StorefrontOrder $storefrontOrder, StorefrontService $storefronts): JsonResponse
    {
        $this->ensureModule('storefront');
        $this->ensureCan('storefrontorders', 'edit');

        try {
            $order = $storefronts->cancelOrder($storefrontOrder);
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first() ?: 'Order tidak bisa dibatalkan.'], 422);
        }

        return $this->ok($order);
    }
}
