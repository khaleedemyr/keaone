<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['categories', 'products', 'subcategories', 'promotions', 'discounts']);
        } else {
            $this->ensureCan('categories', 'view');
        }

        $query = Category::query()->orderBy('sort_order')->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where('name', 'like', "%{$search}%");
        }

        $this->applyActiveStatus($query, $request);

        if ($request->boolean('for_select')) {
            return $this->ok($query->with('preferredSupplier:id,name')->limit(200)->get());
        }

        $page = $query->with('preferredSupplier:id,name')->paginate($this->perPage($request));

        return $this->ok($page->items(), $this->pageMeta($page));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('categories', 'create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
            'show_pos' => ['sometimes', 'boolean'],
            'is_raw_material' => ['sometimes', 'boolean'],
            'procurement_match_mode' => ['sometimes', 'string', 'in:three_way,two_way'],
            'preferred_supplier_id' => ['nullable', 'integer'],
        ]);

        $data['show_pos'] = array_key_exists('show_pos', $data) ? (bool) $data['show_pos'] : true;
        $data['is_raw_material'] = array_key_exists('is_raw_material', $data) ? (bool) $data['is_raw_material'] : false;
        $data['procurement_match_mode'] = $data['procurement_match_mode'] ?? 'three_way';

        if (array_key_exists('preferred_supplier_id', $data)) {
            app(\App\Services\PreferredVendorService::class)
                ->assertSupplier($data['preferred_supplier_id'] ? (int) $data['preferred_supplier_id'] : null);
            $data['preferred_supplier_id'] = $data['preferred_supplier_id'] ?: null;
        }

        $category = Category::query()->create($data);

        return $this->ok($category->load('preferredSupplier:id,name'), [], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $this->ensureCan('categories', 'edit');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
            'show_pos' => ['sometimes', 'boolean'],
            'is_raw_material' => ['sometimes', 'boolean'],
            'procurement_match_mode' => ['sometimes', 'string', 'in:three_way,two_way'],
            'preferred_supplier_id' => ['nullable', 'integer'],
        ]);

        if (array_key_exists('preferred_supplier_id', $data)) {
            app(\App\Services\PreferredVendorService::class)
                ->assertSupplier($data['preferred_supplier_id'] ? (int) $data['preferred_supplier_id'] : null);
            $data['preferred_supplier_id'] = $data['preferred_supplier_id'] ?: null;
        }

        $category->update($data);

        return $this->ok($category->fresh()->load('preferredSupplier:id,name'));
    }

    public function destroy(Category $category): JsonResponse
    {
        $this->ensureCanAny([['categories', 'delete'], ['categories', 'edit']]);
        $category->update(['is_active' => false]);

        return $this->ok($category->fresh());
    }
}
