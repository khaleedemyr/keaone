<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Position;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PositionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['positions', 'users']);
        } else {
            $this->ensureCan('positions', 'view');
        }

        $query = Position::query()->orderBy('rank')->orderBy('sort_order')->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('positions', 'create');

        $position = Position::query()->create($this->validated($request));

        return $this->ok($position, [], 201);
    }

    public function update(Request $request, Position $position): JsonResponse
    {
        $this->ensureCan('positions', 'edit');

        $position->update($this->validated($request, true));

        return $this->ok($position->fresh());
    }

    public function destroy(Position $position): JsonResponse
    {
        $this->ensureCanAny([['positions', 'delete'], ['positions', 'edit']]);
        $position->update(['is_active' => false]);

        return $this->ok($position->fresh());
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:40'],
            'rank' => ['nullable', 'integer', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
