<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalMatrixRule extends Model
{
    use BelongsToCompany;

    public const DOC_TYPES = ['pr', 'po'];

    public const APPROVER_TYPES = ['user', 'role', 'position', 'job_level'];

    protected $fillable = [
        'company_id',
        'doc_type',
        'department_id',
        'min_amount',
        'max_amount',
        'level',
        'approver_type',
        'approver_ref_id',
        'priority',
        'escalate_after_days',
        'escalate_to_user_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'min_amount' => 'integer',
            'max_amount' => 'integer',
            'level' => 'integer',
            'approver_ref_id' => 'integer',
            'priority' => 'integer',
            'escalate_after_days' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public static function rules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'doc_type' => [$required, 'string', 'in:'.implode(',', self::DOC_TYPES)],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'min_amount' => ['nullable', 'integer', 'min:0'],
            'max_amount' => ['nullable', 'integer', 'min:0'],
            'level' => [$required, 'integer', 'min:1', 'max:20'],
            'approver_type' => [$required, 'string', 'in:'.implode(',', self::APPROVER_TYPES)],
            'approver_ref_id' => ['nullable', 'integer', 'min:1'],
            'priority' => ['nullable', 'integer', 'min:0', 'max:999'],
            'escalate_after_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'escalate_to_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function escalateTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'escalate_to_user_id');
    }
}
