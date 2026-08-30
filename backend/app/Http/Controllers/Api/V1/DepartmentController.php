<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DepartmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny([
                'departments',
                'users',
                'purchaserequisitions',
                'purchaseorders',
                'approvalmatrix',
            ]);
        } else {
            $this->ensureCan('departments', 'view');
        }

        $query = Department::query()
            ->with('parent:id,name')
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request, fn (Department $row) => $this->serialize($row));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('departments', 'create');

        $data = $this->validated($request);
        $this->assertValidParent($data['parent_id'] ?? null);

        $department = Department::query()->create($data);

        return $this->ok($this->serialize($department->load('parent:id,name')), [], 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $this->ensureCan('departments', 'edit');

        $data = $this->validated($request, true);
        $parentId = array_key_exists('parent_id', $data) ? $data['parent_id'] : $department->parent_id;
        $this->assertValidParent($parentId, $department->id);

        $department->update($data);

        return $this->ok($this->serialize($department->fresh(['parent:id,name'])));
    }

    public function destroy(Department $department): JsonResponse
    {
        $this->ensureCanAny([['departments', 'delete'], ['departments', 'edit']]);
        $department->update(['is_active' => false]);

        return $this->ok($this->serialize($department->fresh(['parent:id,name'])));
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:40'],
            'parent_id' => ['nullable', 'integer', Rule::exists('departments', 'id')],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function assertValidParent(?int $parentId, ?int $selfId = null): void
    {
        if (! $parentId) {
            return;
        }

        if ($selfId && $parentId === $selfId) {
            throw ValidationException::withMessages([
                'parent_id' => ['Divisi induk tidak valid.'],
            ]);
        }

        $parent = Department::query()->find($parentId);
        if (! $parent) {
            throw ValidationException::withMessages([
                'parent_id' => ['Divisi induk tidak ditemukan.'],
            ]);
        }

        if ($selfId) {
            $cursor = $parent;
            while ($cursor) {
                if ($cursor->id === $selfId) {
                    throw ValidationException::withMessages([
                        'parent_id' => ['Divisi induk tidak boleh membentuk lingkaran.'],
                    ]);
                }
                $cursor = $cursor->parent_id ? Department::query()->find($cursor->parent_id) : null;
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Department $department): array
    {
        return [
            'id' => $department->id,
            'name' => $department->name,
            'code' => $department->code,
            'parent_id' => $department->parent_id,
            'parent_name' => $department->parent?->name,
            'sort_order' => $department->sort_order,
            'is_active' => $department->is_active,
        ];
    }
}
