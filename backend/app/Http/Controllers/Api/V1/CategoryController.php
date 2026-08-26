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
            return $this->ok($query->limit(200)->get());
        }

        $page = $query->paginate($this->perPage($request));

        return $this->ok($page->items(), $this->pageMeta($page));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('categories', 'create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category = Category::query()->create($data);

        return $this->ok($category, [], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $this->ensureCan('categories', 'edit');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category->update($data);

        return $this->ok($category->fresh());
    }

    public function destroy(Category $category): JsonResponse
    {
        $this->ensureCanAny([['categories', 'delete'], ['categories', 'edit']]);
        $category->update(['is_active' => false]);

        return $this->ok($category->fresh());
    }
}
