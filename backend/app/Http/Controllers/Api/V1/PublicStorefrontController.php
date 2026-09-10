<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Storefront;
use App\Models\StorefrontProduct;
use App\Services\StorefrontDomainService;
use App\Services\StorefrontService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicStorefrontController extends Controller
{
    public function show(Request $request, StorefrontDomainService $domains, StorefrontService $storefronts): JsonResponse
    {
        $storefront = $this->resolvePublishedStorefront($request, $domains);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

        if (in_array($storefront->template_key, ['shop_compact', 'shop_classic'], true)) {
            $storefront->template_key = 'shop_nexora';
            $storefront->save();
        }

        $domainHost = (string) ($request->header('X-Storefront-Host') ?: $request->getHost());

        return $this->ok([
            'host' => $domainHost,
            'site_kind' => $storefront->site_kind,
            'template_key' => $storefront->template_key,
            'title' => $storefront->title,
            'tagline' => $storefront->tagline,
            'about' => $storefront->about,
            'logo_url' => $storefront->logoUrl(),
            'brand_colors' => $storefront->brand_colors,
            'theme_content' => is_array($storefront->theme_content) ? $storefront->theme_content : [],
            'home_blocks' => $storefronts->homeBlocksForPublic($storefront),
            'contact_email' => $storefront->contact_email,
            'contact_phone' => $storefront->contact_phone,
            'contact_address' => $storefront->contact_address,
            'seo_title' => $storefront->seo_title,
            'seo_description' => $storefront->seo_description,
            'bank_accounts' => $storefront->isShop() ? ($storefront->bank_accounts ?? []) : [],
            'shipping' => $storefront->isShop() ? $storefronts->shippingPublicPayload($storefront) : null,
            'stock_mode' => $storefront->stock_mode,
            'pages' => $storefront->pages,
        ]);
    }

    public function products(Request $request, StorefrontDomainService $domains, StorefrontService $storefronts): JsonResponse
    {
        $storefront = $this->resolvePublishedShop($request, $domains);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

        $rows = $this->visibleProductsQuery($storefront);
        $collection = $request->string('collection')->toString();
        if ($collection === 'deal') {
            $rows->where('is_deal', true);
        } elseif ($collection === 'new') {
            $rows->where('is_new_arrival', true);
        } elseif ($collection === 'bestseller') {
            $rows->where('is_bestseller', true);
        }

        $mapped = $rows
            ->forPage(max(1, (int) $request->input('page', 1)), min(100, max(1, (int) $request->input('limit', 48))))
            ->get()
            ->map(fn (StorefrontProduct $row) => $storefronts->publicProductPayload($row, $storefront));

        return $this->ok($mapped);
    }

    public function showProduct(Request $request, int $productId, StorefrontDomainService $domains, StorefrontService $storefronts): JsonResponse
    {
        $storefront = $this->resolvePublishedShop($request, $domains);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

        $row = $this->visibleProductsQuery($storefront)
            ->where('product_id', $productId)
            ->first();

        if (! $row) {
            return response()->json(['message' => 'Produk tidak ditemukan.'], 404);
        }

        return $this->ok($storefronts->publicProductPayload($row, $storefront));
    }

    public function productReviews(
        Request $request,
        int $productId,
        StorefrontDomainService $domains,
    ): JsonResponse {
        $storefront = $this->resolvePublishedShop($request, $domains);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

        $reviews = \App\Models\StorefrontProductReview::query()
            ->withoutGlobalScopes()
            ->where('storefront_id', $storefront->id)
            ->where('product_id', $productId)
            ->where('is_published', true)
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn ($review) => [
                'id' => $review->id,
                'customer_name' => $review->customer_name,
                'rating' => (int) $review->rating,
                'comment' => $review->comment,
                'created_at' => optional($review->created_at)?->toIso8601String(),
            ]);

        return $this->ok($reviews);
    }

    public function placeOrder(Request $request, StorefrontDomainService $domains, StorefrontService $storefronts): JsonResponse
    {
        $storefront = $this->resolvePublishedShop($request, $domains);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

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
            if (trim((string) ($data['customer_name'] ?? '')) === '') {
                $data['customer_name'] = $customer->name;
            }
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
            'placed_at' => optional($order->placed_at)?->toIso8601String(),
            'items' => $order->items->map(fn ($item) => [
                'product_id' => $item->product_id,
                'name' => $item->name_snapshot,
                'qty' => $item->qty,
                'unit_price' => $item->unit_price,
                'line_total' => $item->line_total,
            ])->values()->all(),
        ], [], 201);
    }

    public function searchShippingDestinations(
        Request $request,
        StorefrontDomainService $domains,
        StorefrontService $storefronts,
        \App\Services\RajaOngkirService $raja,
    ): JsonResponse {
        $storefront = $this->resolvePublishedShop($request, $domains);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

        $data = $request->validate([
            'search' => ['required', 'string', 'min:2', 'max:120'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        return $this->ok($raja->searchDestinations($storefront, $data['search'], (int) ($data['limit'] ?? 20)));
    }

    public function calculateShipping(
        Request $request,
        StorefrontDomainService $domains,
        StorefrontService $storefronts,
        \App\Services\RajaOngkirService $raja,
    ): JsonResponse {
        $storefront = $this->resolvePublishedShop($request, $domains);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

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

    private function resolvePublishedStorefront(Request $request, StorefrontDomainService $domains): Storefront|JsonResponse
    {
        $host = (string) ($request->header('X-Storefront-Host') ?: $request->getHost());
        $domain = $domains->findByHost($host);

        if (! $domain) {
            return response()->json(['message' => 'Storefront tidak ditemukan untuk domain ini.'], 404);
        }

        $storefront = Storefront::query()
            ->withoutGlobalScopes()
            ->with(['pages' => fn ($q) => $q->withoutGlobalScopes()->where('storefront_id', $domain->storefront_id)->where('is_published', true)->orderBy('sort_order')])
            ->find($domain->storefront_id);

        if (! $storefront || ! $storefront->isPublished()) {
            return response()->json(['message' => 'Storefront belum dipublish.'], 404);
        }

        return $storefront;
    }

    private function resolvePublishedShop(Request $request, StorefrontDomainService $domains): Storefront|JsonResponse
    {
        $storefront = $this->resolvePublishedStorefront($request, $domains);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

        if (! $storefront->isShop()) {
            return response()->json(['message' => 'Katalog tidak tersedia.'], 404);
        }

        return $storefront;
    }

    private function visibleProductsQuery(Storefront $storefront)
    {
        return StorefrontProduct::query()
            ->withoutGlobalScopes()
            ->with([
                'product' => fn ($q) => $q->withoutGlobalScopes()
                    ->select(['id', 'name', 'sku', 'sell_price', 'description', 'is_active', 'category_id'])
                    ->with(['images' => fn ($iq) => $iq->withoutGlobalScopes()->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id')]),
            ])
            ->where('storefront_id', $storefront->id)
            ->where('company_id', $storefront->company_id)
            ->where('is_visible', true)
            ->whereHas('product', fn ($q) => $q->withoutGlobalScopes()->where('company_id', $storefront->company_id)->where('is_active', true))
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
