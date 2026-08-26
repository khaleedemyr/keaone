<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Services\RoleService;
use App\Support\Access;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function __construct(private RoleService $roles) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard('view');

        $scope = $this->scope();
        $query = Role::query()
            ->with('permissions')
            ->where('scope', $scope)
            ->when($scope === 'tenant', fn ($q) => $q->where('company_id', CurrentCompany::id()))
            ->when($scope === 'platform', fn ($q) => $q->whereNull('company_id'))
            ->orderByDesc('is_owner')
            ->orderBy('id');

        if ($search = $request->string('search')->toString()) {
            $query->where('name', 'like', "%{$search}%");
        }

        $this->applyActiveStatus($query, $request);

        $menus = $this->roles->menus($scope);

        if ($request->boolean('for_select')) {
            return $this->ok([
                'menus' => $menus,
                'roles' => $query->limit(200)->get()->map(fn (Role $role) => $role->toPayload())->values(),
            ]);
        }

        $page = $query->paginate($this->perPage($request));

        return $this->ok([
            'menus' => $menus,
            'roles' => $page->getCollection()->map(fn (Role $role) => $role->toPayload())->values(),
        ], $this->pageMeta($page));
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard('create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'permissions' => ['required', 'array'],
        ]);

        $count = Role::query()
            ->where('scope', $this->scope())
            ->when($this->scope() === 'tenant', fn ($q) => $q->where('company_id', CurrentCompany::id()))
            ->when($this->scope() === 'platform', fn ($q) => $q->whereNull('company_id'))
            ->count();
        abort_unless($count < 40, 422, 'Terlalu banyak role.');

        $role = $this->roles->create(
            $this->scope(),
            $this->scope() === 'tenant' ? CurrentCompany::id() : null,
            $data['name'],
            $data['permissions'],
        );

        return $this->ok($role->toPayload(), [], 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $this->guard('edit');
        $this->assertScoped($role);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'permissions' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['name']) || isset($data['permissions'])) {
            $role = $this->roles->update($role, $data['name'] ?? $role->name, $data['permissions'] ?? $role->permissionMap());
        }

        if (array_key_exists('is_active', $data)) {
            abort_if(($role->is_system || $role->is_owner) && ! $data['is_active'], 422, 'Role bawaan tidak bisa dinonaktifkan.');
            $role->update(['is_active' => $data['is_active']]);
        }

        return $this->ok($role->fresh('permissions')->toPayload());
    }

    public function destroy(Role $role): JsonResponse
    {
        $this->guard('delete');
        $this->assertScoped($role);
        $this->roles->deactivate($role);

        return $this->ok($role->fresh('permissions')->toPayload());
    }

    protected function scope(): string
    {
        return 'tenant';
    }

    private function guard(string $action): void
    {
        if ($this->scope() === 'platform') {
            if ($action === 'view' && (Access::canPlatform('roles', 'view') || Access::canPlatform('operators', 'view'))) {
                return;
            }
            $this->ensurePlatformCan('roles', $action);

            return;
        }

        if ($action === 'view' && (Access::can('roles', 'view') || Access::can('users', 'view'))) {
            return;
        }

        $this->ensureCan('roles', $action);
    }

    private function assertScoped(Role $role): void
    {
        abort_unless($role->scope === $this->scope(), 404);
        if ($this->scope() === 'tenant') {
            abort_unless((int) $role->company_id === (int) CurrentCompany::id(), 404);
        } else {
            abort_unless($role->company_id === null, 404);
        }
    }
}
