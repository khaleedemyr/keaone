<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChoiceType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChoiceTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select') && ! \App\Support\CurrentCompany::hasModule('choices')) {
            return $this->ok([]);
        }
        $this->ensureModule('choices');

        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['choicetypes', 'choices', 'products']);
        } else {
            $this->ensureCan('choicetypes', 'view');
        }

        $query = ChoiceType::query()->orderBy('sort_order')->orderBy('name');

        if ($request->boolean('with_choices')) {
            $query->with(['choices' => function ($q) use ($request) {
                $q->orderBy('sort_order')->orderBy('name');
                $this->applyActiveStatus($q, $request);
            }]);
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
        $this->ensureCan('choicetypes', 'create');

        $item = ChoiceType::query()->create($this->validated($request));

        return $this->ok($item, [], 201);
    }

    public function update(Request $request, ChoiceType $choiceType): JsonResponse
    {
        $this->ensureModule('choices');
        $this->ensureCan('choicetypes', 'edit');

        $choiceType->update($this->validated($request, true));

        return $this->ok($choiceType->fresh());
    }

    public function destroy(ChoiceType $choiceType): JsonResponse
    {
        $this->ensureModule('choices');
        $this->ensureCanAny([['choicetypes', 'delete'], ['choicetypes', 'edit']]);
        $choiceType->update(['is_active' => false]);

        return $this->ok($choiceType->fresh());
    }

    private function validated(Request $request, bool $update = false): array
    {
        $data = $request->validate([
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:100'],
            'is_required' => ['sometimes', 'boolean'],
            'min_select' => ['nullable', 'integer', 'min:0', 'max:20'],
            'max_select' => ['nullable', 'integer', 'min:0', 'max:20'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (($data['is_required'] ?? false) && (int) ($data['min_select'] ?? 0) < 1) {
            $data['min_select'] = 1;
        }

        $min = (int) ($data['min_select'] ?? 0);
        $max = (int) ($data['max_select'] ?? 1);
        if ($max > 0 && $min > $max) {
            $data['max_select'] = $min;
        }

        return $data;
    }
}
