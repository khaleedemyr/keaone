<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OutletController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['outlets', 'warehouses', 'users', 'products', 'cafetables']);
        } else {
            $this->ensureCan('outlets', 'view');
        }

        $query = Outlet::query()->orderByDesc('is_default')->orderBy('name');

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
        $this->ensureCan('outlets', 'create');
        $this->ensurePlanLimit('outlets');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'address' => ['nullable', 'string'],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $outlet = DB::transaction(function () use ($data) {
            $outlet = Outlet::query()->create($data);

            if ($outlet->is_default) {
                $this->makeDefault($outlet);
            }

            return $outlet->fresh();
        });

        return $this->ok($outlet, [], 201);
    }

    public function update(Request $request, Outlet $outlet): JsonResponse
    {
        $this->ensureCan('outlets', 'edit');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'address' => ['nullable', 'string'],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('is_active', $data) && $data['is_active'] && ! $outlet->is_active) {
            $this->ensurePlanLimit('outlets');
        }

        if (array_key_exists('is_active', $data) && ! $data['is_active'] && $outlet->is_active) {
            $active = Outlet::query()->where('is_active', true)->whereKeyNot($outlet->id)->count();
            if ($active < 1) {
                return $this->error('Tidak bisa menonaktifkan outlet terakhir.', [], 422);
            }
        }

        DB::transaction(function () use ($outlet, $data) {
            $outlet->update($data);

            if ($outlet->is_default && $outlet->is_active) {
                $this->makeDefault($outlet);
            }

            if (! $outlet->is_active && $outlet->is_default) {
                $outlet->update(['is_default' => false]);
                $next = Outlet::query()->where('is_active', true)->orderBy('id')->first();
                if ($next) {
                    $this->makeDefault($next);
                }
            }
        });

        return $this->ok($outlet->fresh());
    }

    public function destroy(Outlet $outlet): JsonResponse
    {
        $this->ensureCanAny([['outlets', 'delete'], ['outlets', 'edit']]);

        $active = Outlet::query()->where('is_active', true)->whereKeyNot($outlet->id)->count();
        if ($outlet->is_active && $active < 1) {
            return $this->error('Tidak bisa menonaktifkan outlet terakhir.', [], 422);
        }

        $wasDefault = $outlet->is_default;
        $outlet->update(['is_active' => false, 'is_default' => false]);

        if ($wasDefault) {
            $next = Outlet::query()->where('is_active', true)->orderBy('id')->first();
            if ($next) {
                $this->makeDefault($next);
            }
        }

        return $this->ok($outlet->fresh());
    }

    private function makeDefault(Outlet $outlet): void
    {
        Outlet::query()->whereKeyNot($outlet->id)->update(['is_default' => false]);
        $outlet->update(['is_default' => true, 'is_active' => true]);
    }
}
