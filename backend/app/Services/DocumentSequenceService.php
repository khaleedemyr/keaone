<?php

namespace App\Services;

use App\Models\CompanyDocumentSequence;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class DocumentSequenceService
{
    /**
     * Atomic per-company / per-doc-type / per-day sequence.
     */
    public function next(int $companyId, string $docType, string $prefix, int $pad = 3): string
    {
        $period = now()->format('ymd');

        return DB::transaction(function () use ($companyId, $docType, $prefix, $period, $pad) {
            $row = CompanyDocumentSequence::query()
                ->where('company_id', $companyId)
                ->where('doc_type', $docType)
                ->where('period', $period)
                ->lockForUpdate()
                ->first();

            if (! $row) {
                try {
                    $row = CompanyDocumentSequence::query()->create([
                        'company_id' => $companyId,
                        'doc_type' => $docType,
                        'period' => $period,
                        'last_seq' => 0,
                    ]);
                    $row = CompanyDocumentSequence::query()->whereKey($row->id)->lockForUpdate()->firstOrFail();
                } catch (UniqueConstraintViolationException) {
                    $row = CompanyDocumentSequence::query()
                        ->where('company_id', $companyId)
                        ->where('doc_type', $docType)
                        ->where('period', $period)
                        ->lockForUpdate()
                        ->firstOrFail();
                }
            }

            $row->last_seq = (int) $row->last_seq + 1;
            $row->save();

            return $prefix.'-'.$period.'-'.str_pad((string) $row->last_seq, $pad, '0', STR_PAD_LEFT);
        });
    }
}
