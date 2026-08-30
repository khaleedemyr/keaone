<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GlJournalEntry extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'outlet_id',
        'user_id',
        'number',
        'entry_date',
        'source_type',
        'source_id',
        'source_number',
        'description',
        'status',
        'reversed_entry_id',
        'total_debit',
        'total_credit',
    ];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'source_id' => 'integer',
            'reversed_entry_id' => 'integer',
            'total_debit' => 'integer',
            'total_credit' => 'integer',
        ];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(GlJournalLine::class)->orderBy('line_no');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }
}
