<?php

namespace App\Services;

use App\Models\Company;
use App\Models\ProcurementPlan;
use App\Models\ProcurementPlanLine;
use App\Models\Product;
use App\Support\ProcurementSettings;
use Illuminate\Validation\ValidationException;

class ProcurementPlanService
{
    public function enabled(?Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_annual_plan_enabled', $company);
    }

    public function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'plan' => ['Rencana procurement tahunan belum diaktifkan.'],
            ]);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function syncLines(ProcurementPlan $plan, array $lines): ProcurementPlan
    {
        if ($plan->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Rencana hanya bisa diubah saat draft.']]);
        }

        $plan->lines()->delete();

        foreach ($lines as $row) {
            $qty = (int) ($row['qty_planned'] ?? 0);
            if ($qty <= 0) {
                continue;
            }

            ProcurementPlanLine::query()->create([
                'company_id' => $plan->company_id,
                'procurement_plan_id' => $plan->id,
                'product_id' => (int) $row['product_id'],
                'period_month' => isset($row['period_month']) ? (int) $row['period_month'] : null,
                'qty_planned' => $qty,
                'estimated_unit_cost' => max(0, (int) ($row['estimated_unit_cost'] ?? 0)),
                'note' => $row['note'] ?? null,
            ]);
        }

        return $this->loadPlan($plan->fresh());
    }

    public function activate(ProcurementPlan $plan): ProcurementPlan
    {
        if ($plan->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya rencana draft yang bisa diaktifkan.']]);
        }
        if ($plan->lines()->count() === 0) {
            throw ValidationException::withMessages(['lines' => ['Tambahkan minimal satu baris rencana.']]);
        }

        $plan->update([
            'status' => 'active',
            'activated_at' => now(),
        ]);

        return $this->loadPlan($plan->fresh());
    }

    public function close(ProcurementPlan $plan): ProcurementPlan
    {
        if ($plan->status !== 'active') {
            throw ValidationException::withMessages(['status' => ['Hanya rencana aktif yang bisa ditutup.']]);
        }

        $plan->update([
            'status' => 'closed',
            'closed_at' => now(),
        ]);

        return $this->loadPlan($plan->fresh());
    }

    public function loadPlan(ProcurementPlan $plan): ProcurementPlan
    {
        return $plan->load([
            'lines.product:id,name,sku',
            'department:id,name,code',
            'user:id,name',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(ProcurementPlan $plan): array
    {
        $plan = $this->loadPlan($plan);

        $lines = $plan->lines->map(function (ProcurementPlanLine $line) {
            $estimatedTotal = (int) $line->qty_planned * (int) $line->estimated_unit_cost;

            return [
                'id' => $line->id,
                'product_id' => $line->product_id,
                'product_name' => $line->product?->name,
                'sku' => $line->product?->sku,
                'period_month' => $line->period_month,
                'qty_planned' => (int) $line->qty_planned,
                'estimated_unit_cost' => (int) $line->estimated_unit_cost,
                'estimated_total' => $estimatedTotal,
                'note' => $line->note,
            ];
        })->values();

        return [
            'id' => $plan->id,
            'name' => $plan->name,
            'client_uuid' => $plan->client_uuid,
            'fiscal_year' => (int) $plan->fiscal_year,
            'status' => $plan->status,
            'note' => $plan->note,
            'department_id' => $plan->department_id,
            'department' => $plan->department?->only(['id', 'name', 'code']),
            'user' => $plan->user?->only(['id', 'name']),
            'lines' => $lines,
            'planned_total' => (int) $lines->sum('estimated_total'),
            'activated_at' => $plan->activated_at?->toIso8601String(),
            'closed_at' => $plan->closed_at?->toIso8601String(),
            'created_at' => $plan->created_at?->toIso8601String(),
        ];
    }
}
