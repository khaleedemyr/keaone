<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SubCategory;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['subcategories', 'products', 'categories']);
        } else {
            $this->ensureCan('subcategories', 'view');
        }

        $query = SubCategory::query()
            ->with('category:id,name')
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($categoryId = $request->integer('category_id')) {
            $query->where('category_id', $categoryId);
        }

        if ($search = $request->string('search')->toString()) {
            $query->where('name', 'like', "%{$search}%");
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('subcategories', 'create');

        $item = SubCategory::query()->create($this->validated($request));

        return $this->ok($item->load('category:id,name'), [], 201);
    }

    public function update(Request $request, SubCategory $subCategory): JsonResponse
    {
        $this->ensureCan('subcategories', 'edit');

        $subCategory->update($this->validated($request, true));

        return $this->ok($subCategory->fresh()->load('category:id,name'));
    }

    public function destroy(SubCategory $subCategory): JsonResponse
    {
        $this->ensureCanAny([['subcategories', 'delete'], ['subcategories', 'edit']]);
        $subCategory->update(['is_active' => false]);

        return $this->ok($subCategory->fresh()->load('category:id,name'));
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'category_id' => [
                $update ? 'sometimes' : 'required',
                'integer',
                Rule::exists('categories', 'id')->where('company_id', CurrentCompany::id()),
            ],
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:100'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
