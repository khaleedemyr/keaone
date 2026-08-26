<?php

namespace App\Models\Concerns;

use App\Support\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;

trait BelongsToCompany
{
    protected static function bootBelongsToCompany(): void
    {
        static::addGlobalScope('company', function (Builder $query) {
            $companyId = CurrentCompany::id();

            if ($companyId) {
                $query->where($query->getModel()->getTable().'.company_id', $companyId);
            }
        });

        static::creating(function ($model) {
            if (! $model->company_id && CurrentCompany::id()) {
                $model->company_id = CurrentCompany::id();
            }
        });
    }
}
