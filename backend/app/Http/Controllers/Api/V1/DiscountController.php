<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Discount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DiscountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['discounts', 'pos', 'sales']);
        } else {
            $this->ensureCan('discounts', 'view');
        }

        $query = Discount::query()->orderBy('sort_order')->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where('name', 'like', "%{$search}%");
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('discounts', 'create');

        $item = Discount::query()->create($this->validated($request));

        return $this->ok($item, [], 201);
    }

    public function update(Request $request, Discount $discount): JsonResponse
    {
        $this->ensureCan('discounts', 'edit');

        $discount->update($this->validated($request, true));

        return $this->ok($discount->fresh());
    }

    public function destroy(Discount $discount): JsonResponse
    {
        $this->ensureCanAny([['discounts', 'delete'], ['discounts', 'edit']]);
        $discount->update(['is_active' => false]);

        return $this->ok($discount->fresh());
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $data = $request->validate([
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:100'],
            'value_type' => [$partial ? 'sometimes' : 'required', Rule::in(['percent', 'fixed'])],
            'value' => [$partial ? 'sometimes' : 'required', 'integer', 'min:1'],
            'scope' => [$partial ? 'sometimes' : 'required', Rule::in(['item', 'sale'])],
            'max_discount' => ['nullable', 'integer', 'min:0'],
            'min_subtotal' => ['nullable', 'integer', 'min:0'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (($data['value_type'] ?? null) === 'percent' && isset($data['value']) && $data['value'] > 100) {
            abort(422, 'Persen diskon tidak boleh lebih dari 100.');
        }

        return $data;
    }
}
