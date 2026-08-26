<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Choice;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ChoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select') && ! \App\Support\CurrentCompany::hasModule('choices')) {
            return $this->ok([]);
        }
        $this->ensureModule('choices');

        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['choices', 'choicetypes', 'products']);
        } else {
            $this->ensureCan('choices', 'view');
        }

        $query = Choice::query()
            ->with('choiceType:id,name')
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($typeId = $request->integer('choice_type_id')) {
            $query->where('choice_type_id', $typeId);
        }

        if ($search = $request->string('search')->toString()) {
            $query->where('name', 'like', "%{$search}%");
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('choices');
        $this->ensureCan('choices', 'create');

        $item = Choice::query()->create($this->validated($request));

        return $this->ok($item->load('choiceType:id,name'), [], 201);
    }

    public function update(Request $request, Choice $choice): JsonResponse
    {
        $this->ensureModule('choices');
        $this->ensureCan('choices', 'edit');

        $choice->update($this->validated($request, true));

        return $this->ok($choice->fresh()->load('choiceType:id,name'));
    }

    public function destroy(Choice $choice): JsonResponse
    {
        $this->ensureModule('choices');
        $this->ensureCanAny([['choices', 'delete'], ['choices', 'edit']]);
        $choice->update(['is_active' => false]);

        return $this->ok($choice->fresh()->load('choiceType:id,name'));
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'choice_type_id' => [
                $update ? 'sometimes' : 'required',
                'integer',
                Rule::exists('choice_types', 'id')->where('company_id', CurrentCompany::id()),
            ],
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:100'],
            'extra_price' => ['nullable', 'integer', 'min:0'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
