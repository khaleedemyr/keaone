<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

class CompanyUser extends Pivot
{
    protected $table = 'company_user';

    public $incrementing = true;

    public $timestamps = true;

    protected $fillable = [
        'company_id',
        'user_id',
        'outlet_id',
        'role',
        'role_id',
        'employee_code',
        'department_id',
        'position_id',
        'job_level_id',
        'manager_id',
        'hired_at',
        'employment_status',
        'onboarding_status',
        'onboarding_submitted_at',
        'onboarding_approved_at',
        'onboarding_approved_by',
        'invite_id',
        'contract_type',
        'contract_end_at',
        'terminated_at',
        'is_active',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'last_seen_at' => 'datetime',
            'hired_at' => 'date',
            'onboarding_submitted_at' => 'datetime',
            'onboarding_approved_at' => 'datetime',
            'contract_end_at' => 'date',
            'terminated_at' => 'date',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function roleRecord(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function jobLevel(): BelongsTo
    {
        return $this->belongsTo(JobLevel::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'manager_id');
    }
}
