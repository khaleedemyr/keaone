<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Role;
use App\Models\RolePermission;
use App\Models\User;
use App\Support\MenuCatalog;
use Illuminate\Support\Str;

class RoleService
{
    public function ensurePlatformRoles(): void
    {
        foreach ($this->platformDefaults() as $def) {
            $role = Role::query()->firstOrCreate(
                ['scope' => 'platform', 'company_id' => null, 'slug' => $def['slug']],
                [
                    'name' => $def['name'],
                    'is_system' => true,
                    'is_owner' => $def['is_owner'],
                ],
            );
            if ($role->wasRecentlyCreated || $role->permissions()->count() === 0) {
                $this->syncPermissions($role, $def['permissions']);
            }
        }

        Role::query()->where('scope', 'platform')->whereNull('company_id')->each(
            fn (Role $role) => $this->grantMissingMenus($role),
        );
    }

    public function ensureTenantRoles(Company $company): void
    {
        foreach ($this->tenantDefaults() as $def) {
            $role = Role::query()->firstOrCreate(
                ['scope' => 'tenant', 'company_id' => $company->id, 'slug' => $def['slug']],
                [
                    'name' => $def['name'],
                    'is_system' => true,
                    'is_owner' => $def['is_owner'],
                ],
            );
            if ($role->wasRecentlyCreated) {
                $this->syncPermissions($role, $def['permissions']);
            } elseif ($role->permissions()->count() === 0) {
                $this->syncPermissions($role, $def['permissions']);
            }
        }

        Role::query()
            ->where('scope', 'tenant')
            ->where('company_id', $company->id)
            ->each(fn (Role $role) => $this->grantMissingMenus($role));

        $roles = Role::query()
            ->where('scope', 'tenant')
            ->where('company_id', $company->id)
            ->get()
            ->keyBy('slug');

        CompanyUser::query()
            ->where('company_id', $company->id)
            ->whereNull('role_id')
            ->each(function (CompanyUser $row) use ($roles) {
                $match = $roles->get($row->role) ?? $roles->get('cashier');
                if ($match) {
                    $row->update(['role_id' => $match->id, 'role' => $match->slug]);
                }
            });
    }

    public function bindPlatformUsers(): void
    {
        $roles = Role::query()->where('scope', 'platform')->whereNull('company_id')->get()->keyBy('slug');
        User::query()
            ->where('is_platform', true)
            ->whereNull('platform_role_id')
            ->each(function (User $user) use ($roles) {
                $slug = $user->platform_role ?: 'owner';
                $match = $roles->get($slug) ?? $roles->get('owner');
                if ($match) {
                    $user->forceFill([
                        'platform_role_id' => $match->id,
                        'platform_role' => $match->slug,
                    ])->save();
                }
            });
    }

    /**
     * @param  array<string, array{view?: bool, create?: bool, edit?: bool, delete?: bool}>  $permissions
     */
    public function create(string $scope, ?int $companyId, string $name, array $permissions, bool $system = false, bool $owner = false): Role
    {
        $slug = $this->uniqueSlug($scope, $companyId, $name);
        $role = Role::query()->create([
            'scope' => $scope,
            'company_id' => $companyId,
            'name' => $name,
            'slug' => $slug,
            'is_system' => $system,
            'is_owner' => $owner,
        ]);
        $this->syncPermissions($role, $permissions);

        return $role->load('permissions');
    }

    /**
     * @param  array<string, array{view?: bool, create?: bool, edit?: bool, delete?: bool}>  $permissions
     */
    public function update(Role $role, string $name, array $permissions): Role
    {
        $role->update(['name' => $name]);
        if (! $role->is_owner) {
            $this->syncPermissions($role, $permissions);
        }

        return $role->fresh('permissions');
    }

    public function deactivate(Role $role): Role
    {
        abort_if($role->is_system || $role->is_owner, 422, 'Role bawaan tidak bisa dinonaktifkan.');
        $role->update(['is_active' => false]);

        return $role->fresh('permissions');
    }

    /**
     * @return list<array{key: string, actions: list<string>}>
     */
    public function menus(string $scope): array
    {
        return MenuCatalog::for($scope);
    }

    /**
     * @param  array<string, array{view?: bool, create?: bool, edit?: bool, delete?: bool}>  $permissions
     */
    public function syncPermissions(Role $role, array $permissions): void
    {
        $scope = $role->scope;
        foreach (MenuCatalog::for($scope) as $menu) {
            $flags = $permissions[$menu['key']] ?? [];
            $view = (bool) ($flags['view'] ?? false);
            $create = in_array('create', $menu['actions'], true) && (bool) ($flags['create'] ?? false);
            $edit = in_array('edit', $menu['actions'], true) && (bool) ($flags['edit'] ?? false);
            $delete = in_array('delete', $menu['actions'], true) && (bool) ($flags['delete'] ?? false);
            if ($create || $edit || $delete) {
                $view = true;
            }

            RolePermission::query()->updateOrCreate(
                ['role_id' => $role->id, 'menu_key' => $menu['key']],
                [
                    'can_view' => $view,
                    'can_create' => $create,
                    'can_edit' => $edit,
                    'can_delete' => $delete,
                ],
            );
        }
    }

    public function resolveTenantRole(int $companyId, ?int $roleId, ?string $slug): Role
    {
        $query = Role::query()->where('scope', 'tenant')->where('company_id', $companyId);
        $role = $roleId
            ? (clone $query)->whereKey($roleId)->first()
            : (clone $query)->where('slug', $slug)->first();

        abort_unless($role, 422, 'Role tidak valid.');

        return $role;
    }

    public function resolvePlatformRole(?int $roleId, ?string $slug): Role
    {
        $query = Role::query()->where('scope', 'platform')->whereNull('company_id');
        $role = $roleId
            ? (clone $query)->whereKey($roleId)->first()
            : (clone $query)->where('slug', $slug ?: 'support')->first();

        abort_unless($role, 422, 'Role tidak valid.');

        return $role;
    }

    private function uniqueSlug(string $scope, ?int $companyId, string $name): string
    {
        $base = Str::slug($name) ?: 'role';
        $slug = $base;
        $i = 2;
        while (Role::query()
            ->where('scope', $scope)
            ->where('company_id', $companyId)
            ->where('slug', $slug)
            ->exists()) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }

    public function grantMissingMenus(Role $role): void
    {
        $defaults = $role->scope === 'platform' ? $this->platformDefaults() : $this->tenantDefaults();
        $matrix = null;
        foreach ($defaults as $row) {
            if ($row['slug'] === $role->slug) {
                $matrix = $row['permissions'];
                break;
            }
        }

        foreach (MenuCatalog::for($role->scope) as $menu) {
            $exists = RolePermission::query()
                ->where('role_id', $role->id)
                ->where('menu_key', $menu['key'])
                ->exists();
            if ($exists) {
                continue;
            }

            $flags = $matrix[$menu['key']] ?? $this->flags(false, false, false, false);
            RolePermission::query()->create([
                'role_id' => $role->id,
                'menu_key' => $menu['key'],
                'can_view' => (bool) ($flags['view'] ?? false),
                'can_create' => in_array('create', $menu['actions'], true) && (bool) ($flags['create'] ?? false),
                'can_edit' => in_array('edit', $menu['actions'], true) && (bool) ($flags['edit'] ?? false),
                'can_delete' => in_array('delete', $menu['actions'], true) && (bool) ($flags['delete'] ?? false),
            ]);
        }
    }

    /**
     * @return list<array{name: string, slug: string, is_owner: bool, permissions: array<string, array{view: bool, create: bool, edit: bool, delete: bool}>}>
     */
    private function tenantDefaults(): array
    {
        $all = $this->full('tenant');
        $none = $this->empty('tenant');

        $cashier = $none;
        $cashier['chat'] = $this->flags(true, true, false, false);
        $cashier['pos'] = $this->flags(true, true, false, false);
        $cashier['products'] = $this->flags(true, false, false, false);
        $cashier['categories'] = $this->flags(true, false, false, false);
        $cashier['subcategories'] = $this->flags(true, false, false, false);
        $cashier['units'] = $this->flags(true, false, false, false);
        $cashier['itemtypes'] = $this->flags(true, false, false, false);
        $cashier['pricechannels'] = $this->flags(true, false, false, false);
        $cashier['discounts'] = $this->flags(true, false, false, false);
        $cashier['promotions'] = $this->flags(true, false, false, false);
        $cashier['choicetypes'] = $this->flags(true, false, false, false);
        $cashier['choices'] = $this->flags(true, false, false, false);
        $cashier['warehouses'] = $this->flags(true, false, false, false);
        $cashier['sales'] = $this->flags(true, true, false, false);
        $cashier['contacts'] = $this->flags(true, true, false, false);
        $cashier['customers'] = $this->flags(true, true, false, false);
        $cashier['suppliers'] = $this->flags(true, false, false, false);
        $cashier['approvals'] = $this->flags(true, false, true, false);
        $cashier['settings'] = $this->flags(true, false, true, false);

        $viewer = $none;
        $viewer['insight'] = $this->flags(true, false, false, false);
        $viewer['chat'] = $this->flags(true, true, false, false);
        $viewer['products'] = $this->flags(true, false, false, false);
        $viewer['categories'] = $this->flags(true, false, false, false);
        $viewer['subcategories'] = $this->flags(true, false, false, false);
        $viewer['units'] = $this->flags(true, false, false, false);
        $viewer['itemtypes'] = $this->flags(true, false, false, false);
        $viewer['pricechannels'] = $this->flags(true, false, false, false);
        $viewer['discounts'] = $this->flags(true, false, false, false);
        $viewer['promotions'] = $this->flags(true, false, false, false);
        $viewer['choicetypes'] = $this->flags(true, false, false, false);
        $viewer['choices'] = $this->flags(true, false, false, false);
        $viewer['warehouses'] = $this->flags(true, false, false, false);
        $viewer['sales'] = $this->flags(true, false, false, false);
        $viewer['salesreportsummary'] = $this->flags(true, false, false, false);
        $viewer['salesreportproducts'] = $this->flags(true, false, false, false);
        $viewer['salesreportcashiers'] = $this->flags(true, false, false, false);
        $viewer['salesreportmethods'] = $this->flags(true, false, false, false);
        $viewer['salesreportchannels'] = $this->flags(true, false, false, false);
        $viewer['salesreportdaily'] = $this->flags(true, false, false, false);
        $viewer['stock'] = $this->flags(true, false, false, false);
        $viewer['stockcard'] = $this->flags(true, false, false, false);
        $viewer['purchaserequisitions'] = $this->flags(true, false, false, false);
        $viewer['purchaseorders'] = $this->flags(true, false, false, false);
        $viewer['goodsreceipts'] = $this->flags(true, false, false, false);
        $viewer['approvals'] = $this->flags(true, false, true, false);
        $viewer['customers'] = $this->flags(true, false, false, false);
        $viewer['suppliers'] = $this->flags(true, false, false, false);
        $viewer['settings'] = $this->flags(true, false, true, false);

        return [
            ['name' => 'Owner', 'slug' => 'owner', 'is_owner' => true, 'permissions' => $all],
            ['name' => 'Admin', 'slug' => 'admin', 'is_owner' => false, 'permissions' => $all],
            ['name' => 'Kasir', 'slug' => 'cashier', 'is_owner' => false, 'permissions' => $cashier],
            ['name' => 'Viewer', 'slug' => 'viewer', 'is_owner' => false, 'permissions' => $viewer],
        ];
    }

    /**
     * @return list<array{name: string, slug: string, is_owner: bool, permissions: array<string, array{view: bool, create: bool, edit: bool, delete: bool}>}>
     */
    private function platformDefaults(): array
    {
        $all = $this->full('platform');
        $none = $this->empty('platform');
        $support = $none;
        $support['overview'] = $this->flags(true, false, false, false);
        $support['tenants'] = $this->flags(true, false, false, false);
        $support['billing'] = $this->flags(true, false, false, false);
        $support['livesupport'] = $this->flags(true, true, false, false);
        $support['settings'] = $this->flags(true, false, true, false);

        return [
            ['name' => 'Owner', 'slug' => 'owner', 'is_owner' => true, 'permissions' => $all],
            ['name' => 'Admin', 'slug' => 'admin', 'is_owner' => false, 'permissions' => $all],
            ['name' => 'Support', 'slug' => 'support', 'is_owner' => false, 'permissions' => $support],
        ];
    }

    /**
     * @return array<string, array{view: bool, create: bool, edit: bool, delete: bool}>
     */
    private function full(string $scope): array
    {
        $matrix = [];
        foreach (MenuCatalog::for($scope) as $menu) {
            $matrix[$menu['key']] = [
                'view' => in_array('view', $menu['actions'], true),
                'create' => in_array('create', $menu['actions'], true),
                'edit' => in_array('edit', $menu['actions'], true),
                'delete' => in_array('delete', $menu['actions'], true),
            ];
        }

        return $matrix;
    }

    /**
     * @return array<string, array{view: bool, create: bool, edit: bool, delete: bool}>
     */
    private function empty(string $scope): array
    {
        $matrix = [];
        foreach (MenuCatalog::for($scope) as $menu) {
            $matrix[$menu['key']] = $this->flags(false, false, false, false);
        }

        return $matrix;
    }

    /**
     * @return array{view: bool, create: bool, edit: bool, delete: bool}
     */
    private function flags(bool $view, bool $create, bool $edit, bool $delete): array
    {
        return compact('view', 'create', 'edit', 'delete');
    }
}
