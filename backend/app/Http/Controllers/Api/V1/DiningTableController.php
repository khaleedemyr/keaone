<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DiningTable;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DiningTableController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['cafetables', 'pos']);
        } else {
            $this->ensureCan('cafetables', 'view');
        }

        $query = DiningTable::query()
            ->with('outlet:id,name')
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->filled('outlet_id')) {
            $query->where('outlet_id', $request->integer('outlet_id'));
        }

        if ($request->filled('dining_layout_id')) {
            $query->where('dining_layout_id', $request->integer('dining_layout_id'));
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('area', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('cafetables', 'create');

        $item = DiningTable::query()->create($this->validated($request));

        return $this->ok($item->load('outlet:id,name'), [], 201);
    }

    public function update(Request $request, DiningTable $diningTable): JsonResponse
    {
        $this->ensureCan('cafetables', 'edit');

        $diningTable->update($this->validated($request, $diningTable->id));

        return $this->ok($diningTable->fresh()->load('outlet:id,name'));
    }

    public function destroy(DiningTable $diningTable): JsonResponse
    {
        $this->ensureCanAny([['cafetables', 'delete'], ['cafetables', 'edit']]);
        $diningTable->update(['is_active' => false]);

        return $this->ok($diningTable->fresh()->load('outlet:id,name'));
    }

    private function validated(Request $request, ?int $id = null): array
    {
        $data = $request->validate([
            'name' => [$id ? 'sometimes' : 'required', 'string', 'max:80'],
            'area' => ['nullable', 'string', 'max:80'],
            'seats' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'shape' => ['sometimes', Rule::in(['rect', 'round'])],
            'x' => ['sometimes', 'integer', 'min:0', 'max:5000'],
            'y' => ['sometimes', 'integer', 'min:0', 'max:5000'],
            'width' => ['sometimes', 'integer', 'min:32', 'max:400'],
            'height' => ['sometimes', 'integer', 'min:32', 'max:400'],
            'rotation' => ['sometimes', 'integer', 'min:0', 'max:359'],
            'dining_layout_id' => [
                'nullable',
                'integer',
                Rule::exists('dining_layouts', 'id')->where('company_id', CurrentCompany::id()),
            ],
            'outlet_id' => [
                $id ? 'sometimes' : 'nullable',
                'integer',
                Rule::exists('outlets', 'id')->where('company_id', CurrentCompany::id()),
            ],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('area', $data)) {
            $data['area'] = $data['area'] !== '' && $data['area'] !== null ? $data['area'] : null;
        }

        if (! $id && empty($data['outlet_id'])) {
            $data['outlet_id'] = CurrentCompany::outlet()?->id;
        }

        if (! $id && empty($data['outlet_id'])) {
            throw ValidationException::withMessages([
                'outlet_id' => ['Outlet belum dipilih.'],
            ]);
        }

        return $data;
    }
}
