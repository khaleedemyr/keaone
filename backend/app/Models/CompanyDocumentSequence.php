<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class CompanyDocumentSequence extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'doc_type',
        'period',
        'last_seq',
    ];

    protected function casts(): array
    {
        return [
            'last_seq' => 'integer',
        ];
    }
}
