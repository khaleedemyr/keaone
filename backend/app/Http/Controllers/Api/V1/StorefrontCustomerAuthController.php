<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Middleware\AuthenticateStorefrontCustomer;
use App\Models\Storefront;
use App\Models\StorefrontCustomer;
use App\Models\StorefrontOrder;
use App\Models\User;
use App\Services\StorefrontDomainService;
use App\Services\StorefrontService;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class StorefrontCustomerAuthController extends Controller
{
    public function register(
        Request $request,
        StorefrontDomainService $domains,
        StorefrontService $storefronts,
    ): JsonResponse {
        $storefront = $this->resolveShop($request, $domains, $storefronts, allowPreview: true);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:120'],
            'password' => ['required', 'string', 'min:6', 'max:100'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:2000'],
        ]);

        $result = $storefronts->registerCustomer($storefront, $data);

        return $this->ok([
            'token' => $result['token'],
            'token_type' => 'Bearer',
            'customer' => $result['customer'],
        ], [], 201);
    }

    public function login(
        Request $request,
        StorefrontDomainService $domains,
        StorefrontService $storefronts,
    ): JsonResponse {
        $storefront = $this->resolveShop($request, $domains, $storefronts, allowPreview: true);
        if ($storefront instanceof JsonResponse) {
            return $storefront;
        }

        $data = $request->validate([
            'email' => ['required', 'email', 'max:120'],
            'password' => ['required', 'string', 'max:100'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $result = $storefronts->loginCustomer(
            $storefront,
            $data['email'],
            $data['password'],
            (bool) ($data['remember'] ?? true),
        );

        return $this->ok([
            'token' => $result['token'],
            'token_type' => 'Bearer',
            'customer' => $result['customer'],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $customer = AuthenticateStorefrontCustomer::resolve($request);
        if (! $customer) {
            return response()->json(['message' => 'Silakan login terlebih dahulu.'], 401);
        }

        return $this->ok($customer->toPublicArray());
    }

    public function logout(Request $request): JsonResponse
    {
        $customer = AuthenticateStorefrontCustomer::resolve($request);
        if ($customer) {
            $token = $customer->currentAccessToken();
            if ($token) {
                $token->delete();
            } else {
                $plain = $request->bearerToken();
                if ($plain) {
                    $access = \Laravel\Sanctum\PersonalAccessToken::findToken($plain);
                    $access?->delete();
                }
            }
        }

        return $this->ok(['logged_out' => true]);
    }

    public function orders(Request $request): JsonResponse
    {
        $customer = AuthenticateStorefrontCustomer::resolve($request);
        if (! $customer) {
            return response()->json(['message' => 'Silakan login terlebih dahulu.'], 401);
        }

        $query = StorefrontOrder::query()
            ->withoutGlobalScopes()
            ->with(['items'])
            ->where('storefront_id', $customer->storefront_id)
            ->where('company_id', $customer->company_id);

        // Only orders linked to this customer's contact — never match bare guest email
        // (prevents registering with someone's email to read their guest orders).
        if ($customer->contact_id) {
            $query->where('contact_id', $customer->contact_id);
        } else {
            $query->whereRaw('1 = 0');
        }

        $orderModels = $query
            ->orderByDesc('placed_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $orderIds = $orderModels->pluck('id')->all();
        $reviewedPairs = \App\Models\StorefrontProductReview::query()
            ->withoutGlobalScopes()
            ->whereIn('storefront_order_id', $orderIds)
            ->get(['storefront_order_id', 'product_id'])
            ->map(fn ($r) => $r->storefront_order_id.':'.$r->product_id)
            ->all();
        $reviewedSet = array_fill_keys($reviewedPairs, true);

        $rows = $orderModels->map(fn (StorefrontOrder $order) => [
            'id' => $order->id,
            'number' => $order->number,
            'status' => $order->status,
            'subtotal' => $order->subtotal,
            'shipping_cost' => $order->shipping_cost,
            'total' => $order->total,
            'customer_address' => $order->customer_address,
            'note' => $order->note,
            'shipping_snapshot' => $order->shipping_snapshot,
            'tracking_number' => $order->tracking_number,
            'placed_at' => optional($order->placed_at)?->toIso8601String(),
            'paid_at' => optional($order->paid_at)?->toIso8601String(),
            'shipped_at' => optional($order->shipped_at)?->toIso8601String(),
            'delivered_at' => optional($order->delivered_at)?->toIso8601String(),
            'can_review' => $order->status === 'delivered',
            'items' => $order->items->map(fn ($item) => [
                'product_id' => $item->product_id,
                'name' => $item->name_snapshot,
                'qty' => $item->qty,
                'line_total' => $item->line_total,
                'variant_snapshot' => $item->variant_snapshot,
                'reviewed' => isset($reviewedSet[$order->id.':'.$item->product_id]),
            ])->values()->all(),
        ]);

        return $this->ok($rows);
    }

    public function submitReview(Request $request, StorefrontService $storefronts): JsonResponse
    {
        $customer = AuthenticateStorefrontCustomer::resolve($request);
        if (! $customer) {
            return response()->json(['message' => 'Silakan login terlebih dahulu.'], 401);
        }

        $data = $request->validate([
            'order_id' => ['required', 'integer', 'min:1'],
            'product_id' => ['required', 'integer', 'min:1'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $storefront = Storefront::query()
            ->withoutGlobalScopes()
            ->find($customer->storefront_id);
        if (! $storefront) {
            return response()->json(['message' => 'Toko tidak ditemukan.'], 404);
        }

        $order = StorefrontOrder::query()
            ->withoutGlobalScopes()
            ->with('items')
            ->whereKey($data['order_id'])
            ->where('storefront_id', $customer->storefront_id)
            ->first();
        if (! $order) {
            return response()->json(['message' => 'Order tidak ditemukan.'], 404);
        }

        try {
            $review = $storefronts->submitProductReview($storefront, $order, $customer, $data);
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first() ?: 'Ulasan gagal dikirim.'], 422);
        }

        return $this->ok([
            'id' => $review->id,
            'rating' => $review->rating,
            'comment' => $review->comment,
        ], [], 201);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $customer = AuthenticateStorefrontCustomer::resolve($request);
        if (! $customer) {
            return response()->json(['message' => 'Silakan login terlebih dahulu.'], 401);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:2000'],
        ]);

        $customer->fill($data)->save();

        if ($customer->contact_id) {
            $customer->contact?->fill([
                'name' => $customer->name,
                'phone' => $customer->phone,
                'address' => $customer->address,
            ])->save();
        }

        return $this->ok($customer->fresh()->toPublicArray());
    }

    private function resolveShop(
        Request $request,
        StorefrontDomainService $domains,
        StorefrontService $storefronts,
        bool $allowPreview = false,
    ): Storefront|JsonResponse {
        $host = (string) ($request->header('X-Storefront-Host') ?: '');
        if ($host !== '') {
            $domain = $domains->findByHost($host);
            if ($domain) {
                $storefront = Storefront::query()->withoutGlobalScopes()->find($domain->storefront_id);
                if ($storefront && $storefront->isPublished() && $storefront->isShop()) {
                    return $storefront;
                }
            }
        }

        // Preview / tenant context: staff token + company header.
        if ($allowPreview && $request->user() instanceof User) {
            $company = CurrentCompany::company();
            if ($company) {
                $storefront = $storefronts->forCompany($company);
                if ($storefront->isShop()) {
                    return $storefront;
                }
            }
        }

        // Also try request host for public live sites.
        $fallbackHost = (string) $request->getHost();
        $domain = $domains->findByHost($fallbackHost);
        if ($domain) {
            $storefront = Storefront::query()->withoutGlobalScopes()->find($domain->storefront_id);
            if ($storefront && $storefront->isPublished() && $storefront->isShop()) {
                return $storefront;
            }
        }

        return response()->json(['message' => 'Toko tidak ditemukan untuk login pembeli.'], 404);
    }
}
