<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Role extends Model
{
    protected $fillable = [
        'scope',
        'company_id',
        'name',
        'slug',
        'is_system',
        'is_owner',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'is_owner' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function permissions(): HasMany
    {
        return $this->hasMany(RolePermission::class);
    }

    /**
     * @return array<string, array{view: bool, create: bool, edit: bool, delete: bool}>
     */
    public function permissionMap(): array
    {
        $map = [];
        foreach ($this->permissions as $row) {
            $map[$row->menu_key] = [
                'view' => (bool) $row->can_view,
                'create' => (bool) $row->can_create,
                'edit' => (bool) $row->can_edit,
                'delete' => (bool) $row->can_delete,
            ];
        }

        return $map;
    }

    /**
     * @return array{id: int, name: string, slug: string, is_system: bool, is_owner: bool, is_active: bool, permissions: array<string, array{view: bool, create: bool, edit: bool, delete: bool}>}
     */
    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'is_system' => $this->is_system,
            'is_owner' => $this->is_owner,
            'is_active' => $this->is_active,
            'permissions' => $this->permissionMap(),
        ];
    }
}
