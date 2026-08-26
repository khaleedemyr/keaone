<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use App\Services\PromotionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromotionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select') && ! \App\Support\CurrentCompany::hasModule('promotions')) {
            return $this->ok([]);
        }
        $this->ensureModule('promotions');

        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['promotions', 'pos', 'sales']);
        } else {
            $this->ensureCan('promotions', 'view');
        }

        $query = Promotion::query()
            ->with(['products:id,name', 'categories:id,name'])
            ->orderByDesc('priority')
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('for_select')) {
            $query->where('is_active', true);
            $now = now();
            $query->where(function ($q) use ($now) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })->where(function ($q) use ($now) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            });
        } else {
            $this->applyActiveStatus($query, $request);
        }

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('promotions');
        $this->ensureCan('promotions', 'create');

        $data = $this->validated($request);
        $productIds = $data['product_ids'] ?? [];
        $categoryIds = $data['category_ids'] ?? [];
        unset($data['product_ids'], $data['category_ids']);

        $item = Promotion::query()->create($data);
        $item->products()->sync($productIds);
        $item->categories()->sync($categoryIds);

        return $this->ok($item->load(['products:id,name', 'categories:id,name']), [], 201);
    }

    public function update(Request $request, Promotion $promotion): JsonResponse
    {
        $this->ensureModule('promotions');
        $this->ensureCan('promotions', 'edit');

        $data = $this->validated($request, true);
        $productIds = $data['product_ids'] ?? null;
        $categoryIds = $data['category_ids'] ?? null;
        unset($data['product_ids'], $data['category_ids']);

        $promotion->update($data);
        if (is_array($productIds)) {
            $promotion->products()->sync($productIds);
        }
        if (is_array($categoryIds)) {
            $promotion->categories()->sync($categoryIds);
        }

        return $this->ok($promotion->fresh(['products:id,name', 'categories:id,name']));
    }

    public function destroy(Promotion $promotion): JsonResponse
    {
        $this->ensureModule('promotions');
        $this->ensureCanAny([['promotions', 'delete'], ['promotions', 'edit']]);
        $promotion->update(['is_active' => false]);

        return $this->ok($promotion->fresh(['products:id,name', 'categories:id,name']));
    }

    public function preview(Request $request, PromotionService $promotions): JsonResponse
    {
        if (! \App\Support\CurrentCompany::hasModule('promotions')) {
            return $this->ok([
                'promotion_id' => null,
                'promotion_name' => null,
                'discount_total' => 0,
                'item_discounts' => [],
                'sale_discount' => 0,
            ]);
        }
        $this->ensureCanAny(['promotions', 'pos', 'sales']);

        $data = $request->validate([
            'promotion_id' => ['nullable', 'integer'],
            'code' => ['nullable', 'string', 'max:40'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.price' => ['required', 'integer', 'min:0'],
            'items.*.category_id' => ['nullable', 'integer'],
        ]);

        $promotion = null;
        if (! empty($data['promotion_id'])) {
            $promotion = $promotions->findActive((int) $data['promotion_id']);
        } elseif (! empty($data['code'])) {
            $promotion = $promotions->findByCode(trim((string) $data['code']));
        }

        abort_unless($promotion, 422, 'Promo tidak valid.');

        $lines = $data['items'];
        $subtotal = array_sum(array_map(fn ($line) => $line['qty'] * $line['price'], $lines));
        $applied = $promotions->apply($promotion, $lines, $subtotal);

        return $this->ok([
            'promotion_id' => $promotion->id,
            'promotion_name' => $promotion->name,
            'discount_total' => array_sum($applied['item_discounts']) + $applied['sale_discount'],
            'item_discounts' => $applied['item_discounts'],
            'sale_discount' => $applied['sale_discount'],
        ]);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $data = $request->validate([
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:100'],
            'type' => [$partial ? 'sometimes' : 'required', Rule::in(['percent', 'fixed', 'bogo', 'bundle'])],
            'value' => ['nullable', 'integer', 'min:0'],
            'scope' => ['nullable', Rule::in(['item', 'sale'])],
            'max_discount' => ['nullable', 'integer', 'min:0'],
            'min_subtotal' => ['nullable', 'integer', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'code' => ['nullable', 'string', 'max:40'],
            'apply_mode' => ['nullable', Rule::in(['manual', 'auto'])],
            'priority' => ['nullable', 'integer', 'min:0'],
            'config' => ['nullable', 'array'],
            'config.buy_qty' => ['nullable', 'integer', 'min:1'],
            'config.get_qty' => ['nullable', 'integer', 'min:1'],
            'config.buy_product_ids' => ['nullable', 'array'],
            'config.buy_product_ids.*' => ['integer'],
            'config.get_product_ids' => ['nullable', 'array'],
            'config.get_product_ids.*' => ['integer'],
            'config.bundle_price' => ['nullable', 'integer', 'min:0'],
            'config.items' => ['nullable', 'array'],
            'product_ids' => ['nullable', 'array'],
            'product_ids.*' => ['integer'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $type = $data['type'] ?? 'percent';
        if ($type === 'percent' && isset($data['value']) && $data['value'] > 100) {
            abort(422, 'Persen promo tidak boleh lebih dari 100.');
        }

        if (! isset($data['scope'])) {
            $data['scope'] = in_array($type, ['bogo', 'bundle'], true) ? 'item' : 'sale';
        }
        if (! isset($data['apply_mode'])) {
            $data['apply_mode'] = 'manual';
        }
        $data['value'] ??= 0;

        return $data;
    }
}
