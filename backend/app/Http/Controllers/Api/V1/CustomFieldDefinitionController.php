<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CustomFieldDefinition;
use App\Services\CustomFieldService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomFieldDefinitionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_form')) {
            $this->ensureCanAny(['customfields', 'products', 'customers', 'suppliers']);
        } else {
            $this->ensureCan('customfields', 'view');
        }

        $query = CustomFieldDefinition::query()
            ->orderBy('entity')
            ->orderBy('sort_order')
            ->orderBy('id');

        if ($entity = $request->string('entity')->toString()) {
            $query->where('entity', $entity);
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('label', 'like', "%{$search}%")
                    ->orWhere('key', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('for_form')) {
            $query->where('is_active', true);
        } else {
            $this->applyActiveStatus($query, $request);
        }

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('customfields', 'create');

        $data = $this->validated($request);
        $item = CustomFieldDefinition::query()->create($data);

        return $this->ok($item, [], 201);
    }

    public function update(Request $request, CustomFieldDefinition $custom_field_definition): JsonResponse
    {
        $this->ensureCan('customfields', 'edit');

        $custom_field_definition->update($this->validated($request, $custom_field_definition));

        return $this->ok($custom_field_definition->fresh());
    }

    public function destroy(CustomFieldDefinition $custom_field_definition): JsonResponse
    {
        $this->ensureCanAny([['customfields', 'delete'], ['customfields', 'edit']]);
        $custom_field_definition->update(['is_active' => false]);

        return $this->ok($custom_field_definition->fresh());
    }

    private function validated(Request $request, ?CustomFieldDefinition $existing = null): array
    {
        $partial = $existing !== null;
        $data = $request->validate([
            'entity' => [$partial ? 'sometimes' : 'required', Rule::in(CustomFieldDefinition::ENTITIES)],
            'label' => [$partial ? 'sometimes' : 'required', 'string', 'max:120'],
            'key' => ['nullable', 'string', 'max:64', 'regex:/^[a-z][a-z0-9_]*$/'],
            'type' => [$partial ? 'sometimes' : 'required', Rule::in(CustomFieldDefinition::TYPES)],
            'options' => ['nullable', 'array'],
            'options.*' => ['string', 'max:120'],
            'is_required' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        if (array_key_exists('label', $data) && empty($data['key']) && ! $existing) {
            $data['key'] = CustomFieldService::makeKey($data['label']);
        }

        if (empty($data['key']) && $existing) {
            unset($data['key']);
        }

        $type = $data['type'] ?? $existing?->type;
        if ($type === 'select') {
            $options = array_values(array_filter(array_map('trim', $data['options'] ?? $existing?->options ?? [])));
            if ($options === []) {
                abort(422, 'Field select wajib punya opsi.');
            }
            $data['options'] = $options;
        } else {
            $data['options'] = null;
        }

        $entity = $data['entity'] ?? $existing?->entity;
        $key = $data['key'] ?? $existing?->key;
        if ($entity && $key) {
            $dup = CustomFieldDefinition::query()
                ->where('entity', $entity)
                ->where('key', $key)
                ->when($existing, fn ($q) => $q->where('id', '!=', $existing->id))
                ->exists();
            if ($dup) {
                abort(422, 'Key field sudah dipakai di entitas ini.');
            }
        }

        return $data;
    }
}
