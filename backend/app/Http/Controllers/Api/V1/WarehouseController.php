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
                app(\App\Services\InventoryService::class)->makeOutletDefault($warehouse);
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
        $inventory = app(\App\Services\InventoryService::class);

        DB::transaction(function () use ($warehouse, $data, $inventory) {
            $warehouse->update($data);

            if ($warehouse->is_default && $warehouse->is_active) {
                $inventory->makeOutletDefault($warehouse);
            }

            if (! $warehouse->is_active && $warehouse->is_default) {
                $warehouse->update(['is_default' => false]);
                $nextQuery = Warehouse::query()->where('is_active', true)->orderBy('id');
                if ($warehouse->outlet_id) {
                    $nextQuery->where('outlet_id', $warehouse->outlet_id);
                } else {
                    $nextQuery->whereNull('outlet_id');
                }
                $next = $nextQuery->first();
                if ($next) {
                    $inventory->makeOutletDefault($next);
                }
            }
        });

        return $this->ok($warehouse->fresh()->load('outlet:id,name'));
    }

    public function destroy(Warehouse $warehouse): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCanAny([['warehouses', 'delete'], ['warehouses', 'edit']]);

        $inventory = app(\App\Services\InventoryService::class);
        $wasDefault = $warehouse->is_default;
        $outletId = $warehouse->outlet_id;
        $warehouse->update(['is_active' => false, 'is_default' => false]);

        if ($wasDefault) {
            $nextQuery = Warehouse::query()->where('is_active', true)->orderBy('id');
            if ($outletId) {
                $nextQuery->where('outlet_id', $outletId);
            } else {
                $nextQuery->whereNull('outlet_id');
            }
            $next = $nextQuery->first();
            if ($next) {
                $inventory->makeOutletDefault($next);
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
            'location_type' => ['sometimes', 'nullable', 'string', Rule::in(\App\Support\InventoryOps::warehouseLocationTypes())],
        ]);
    }
}
