<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WarehouseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select') && ! \App\Support\CurrentCompany::hasModule('stock')) {
            return $this->ok([]);
        }
        $this->ensureModule('stock');

        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['warehouses', 'stock']);
        } else {
            $this->ensureCan('warehouses', 'view');
        }

        $query = Warehouse::query()
            ->with('outlet:id,name')
            ->orderByDesc('is_default')
            ->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('warehouses', 'create');

        $warehouse = DB::transaction(function () use ($request) {
            $warehouse = Warehouse::query()->create($this->validated($request));

            if ($warehouse->is_default) {
                $this->makeDefault($warehouse);
            }

            return $warehouse->fresh()->load('outlet:id,name');
        });

        return $this->ok($warehouse, [], 201);
    }

    public function update(Request $request, Warehouse $warehouse): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('warehouses', 'edit');

        $data = $this->validated($request, true);

        DB::transaction(function () use ($warehouse, $data) {
            $warehouse->update($data);

            if ($warehouse->is_default && $warehouse->is_active) {
                $this->makeDefault($warehouse);
            }

            if (! $warehouse->is_active && $warehouse->is_default) {
                $warehouse->update(['is_default' => false]);
                $next = Warehouse::query()->where('is_active', true)->orderBy('id')->first();
                if ($next) {
                    $this->makeDefault($next);
                }
            }
        });

        return $this->ok($warehouse->fresh()->load('outlet:id,name'));
    }

    public function destroy(Warehouse $warehouse): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCanAny([['warehouses', 'delete'], ['warehouses', 'edit']]);

        $wasDefault = $warehouse->is_default;
        $warehouse->update(['is_active' => false, 'is_default' => false]);

        if ($wasDefault) {
            $next = Warehouse::query()->where('is_active', true)->orderBy('id')->first();
            if ($next) {
                $this->makeDefault($next);
            }
        }

        return $this->ok($warehouse->fresh()->load('outlet:id,name'));
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:120'],
            'address' => ['nullable', 'string'],
            'outlet_id' => [
                'nullable',
                'integer',
                Rule::exists('outlets', 'id')->where('company_id', CurrentCompany::id()),
            ],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function makeDefault(Warehouse $warehouse): void
    {
        Warehouse::query()->whereKeyNot($warehouse->id)->update(['is_default' => false]);
        $warehouse->update(['is_default' => true, 'is_active' => true]);
    }
}
