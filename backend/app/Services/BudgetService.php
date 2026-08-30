<?php

namespace App\Services;

use App\Models\Budget;
use App\Models\BudgetCommitment;
use App\Models\BudgetLine;
use App\Models\Company;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Support\ProcurementSettings;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BudgetService
{
    public function enabled(?Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_budget_check_enabled', $company);
    }

    public function commitForPrSubmit(PurchaseRequisition $pr): void
    {
        if (! $this->enabled()) {
            return;
        }

        $pr = $this->loadPrForBudget($pr);
        $amount = $this->estimatePrAmount($pr);
        if ($amount <= 0) {
            return;
        }

        $this->assertDepartment($pr->department_id);
        $this->releaseForSource('purchase_requisition', (int) $pr->id);

        $line = $this->resolveBudgetLine((int) $pr->company_id, $pr->department_id, $pr->outlet_id);
        $this->assertAvailable($line, $amount);

        BudgetCommitment::query()->create([
            'company_id' => $pr->company_id,
            'budget_id' => $line->budget_id,
            'budget_line_id' => $line->id,
            'source_type' => 'purchase_requisition',
            'source_id' => $pr->id,
            'source_number' => $pr->number,
            'amount' => $amount,
            'status' => 'active',
            'committed_at' => now(),
        ]);
    }

    public function commitForPoSubmit(PurchaseOrder $po): void
    {
        if (! $this->enabled()) {
            return;
        }

        $po = $this->loadPoForBudget($po);
        $amount = $this->resolvePoAmount($po);
        if ($amount <= 0) {
            return;
        }

        $this->assertDepartment($po->department_id);

        if ($po->purchase_requisition_id) {
            $this->releaseForSource('purchase_requisition', (int) $po->purchase_requisition_id);
        }

        $this->releaseForSource('purchase_order', (int) $po->id);

        $line = $this->resolveBudgetLine((int) $po->company_id, $po->department_id, $po->outlet_id);
        $this->assertAvailable($line, $amount);

        BudgetCommitment::query()->create([
            'company_id' => $po->company_id,
            'budget_id' => $line->budget_id,
            'budget_line_id' => $line->id,
            'source_type' => 'purchase_order',
            'source_id' => $po->id,
            'source_number' => $po->number,
            'amount' => $amount,
            'status' => 'active',
            'committed_at' => now(),
        ]);
    }

    public function releaseForPr(PurchaseRequisition $pr): void
    {
        if (! $this->enabled()) {
            return;
        }

        $this->releaseForSource('purchase_requisition', (int) $pr->id);
    }

    public function releaseForPo(PurchaseOrder $po): void
    {
        if (! $this->enabled()) {
            return;
        }

        $this->releaseForSource('purchase_order', (int) $po->id);
    }

    public function releaseForSource(string $sourceType, int $sourceId): void
    {
        BudgetCommitment::query()
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->where('status', 'active')
            ->update([
                'status' => 'released',
                'released_at' => now(),
            ]);
    }

    /**
     * @param  array<int, array{department_id?: int|null, outlet_id?: int|null, amount: int, note?: string|null}>  $lines
     */
    public function syncLines(Budget $budget, array $lines): Budget
    {
        if ($budget->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Anggaran hanya bisa diubah saat draft.']]);
        }

        $budget->lines()->delete();

        foreach ($lines as $row) {
            $amount = (int) ($row['amount'] ?? 0);
            if ($amount <= 0) {
                continue;
            }

            BudgetLine::query()->create([
                'budget_id' => $budget->id,
                'department_id' => $row['department_id'] ?? null,
                'outlet_id' => $row['outlet_id'] ?? null,
                'amount' => $amount,
                'note' => $row['note'] ?? null,
            ]);
        }

        return $this->loadBudget($budget->fresh());
    }

    public function activate(Budget $budget): Budget
    {
        if ($budget->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya anggaran draft yang bisa diaktifkan.']]);
        }
        if ($budget->lines()->count() === 0) {
            throw ValidationException::withMessages(['lines' => ['Tambahkan minimal satu baris anggaran.']]);
        }

        $budget->update(['status' => 'active']);

        return $this->loadBudget($budget->fresh());
    }

    public function close(Budget $budget): Budget
    {
        if ($budget->status !== 'active') {
            throw ValidationException::withMessages(['status' => ['Hanya anggaran aktif yang bisa ditutup.']]);
        }

        BudgetCommitment::query()
            ->where('budget_id', $budget->id)
            ->where('status', 'active')
            ->update([
                'status' => 'released',
                'released_at' => now(),
            ]);

        $budget->update(['status' => 'closed']);

        return $this->loadBudget($budget->fresh());
    }

    public function loadBudget(Budget $budget): Budget
    {
        return $budget->load([
            'lines.department:id,name,code',
            'lines.outlet:id,name',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(Budget $budget): array
    {
        $budget = $this->loadBudget($budget);
        $lineIds = $budget->lines->pluck('id')->all();
        $committedByLine = $this->committedByLineIds($lineIds);

        $lines = $budget->lines->map(function (BudgetLine $line) use ($committedByLine) {
            $committed = (int) ($committedByLine[$line->id] ?? 0);
            $allocated = (int) $line->amount;

            return [
                'id' => $line->id,
                'department_id' => $line->department_id,
                'department_name' => $line->department?->name,
                'outlet_id' => $line->outlet_id,
                'outlet_name' => $line->outlet?->name,
                'amount' => $allocated,
                'committed' => $committed,
                'available' => max(0, $allocated - $committed),
                'note' => $line->note,
            ];
        })->values();

        $allocatedTotal = (int) $lines->sum('amount');
        $committedTotal = (int) $lines->sum('committed');

        return [
            'id' => $budget->id,
            'name' => $budget->name,
            'fiscal_year' => $budget->fiscal_year,
            'period_start' => $budget->period_start?->toDateString(),
            'period_end' => $budget->period_end?->toDateString(),
            'status' => $budget->status,
            'note' => $budget->note,
            'allocated_total' => $allocatedTotal,
            'committed_total' => $committedTotal,
            'available_total' => max(0, $allocatedTotal - $committedTotal),
            'lines' => $lines,
            'created_at' => $budget->created_at?->toIso8601String(),
            'updated_at' => $budget->updated_at?->toIso8601String(),
        ];
    }

    public function estimatePrAmount(PurchaseRequisition $pr): int
    {
        $pr->loadMissing(['items.product']);
        $total = 0;

        foreach ($pr->items as $item) {
            $factor = max(1, (int) ($item->factor_to_base ?: 1));
            $qty = (int) $item->qty;
            $unitCost = $this->estimateUnitCost((int) $item->product_id, $factor, (int) ($item->product?->cost_price ?? 0));
            $total += $qty * $unitCost;
        }

        return $total;
    }

    private function resolvePoAmount(PurchaseOrder $po): int
    {
        $total = (int) $po->total;
        if ($total > 0) {
            return $total;
        }

        return (int) $po->items->sum('total');
    }

    private function loadPrForBudget(PurchaseRequisition $pr): PurchaseRequisition
    {
        return $pr->loadMissing(['items.product']);
    }

    private function loadPoForBudget(PurchaseOrder $po): PurchaseOrder
    {
        return $po->loadMissing(['items']);
    }

    private function assertDepartment(?int $departmentId): void
    {
        if (ProcurementSettings::costCenterEnabled() && ! $departmentId) {
            throw ValidationException::withMessages([
                'department_id' => ['Departemen wajib diisi untuk cek anggaran.'],
            ]);
        }
    }

    private function assertAvailable(BudgetLine $line, int $amount): void
    {
        $committed = $this->committedAmount((int) $line->id);
        $available = (int) $line->amount - $committed;

        if ($amount > $available) {
            throw ValidationException::withMessages([
                'budget' => [
                    sprintf(
                        'Anggaran tidak mencukupi. Tersedia %s, dibutuhkan %s.',
                        number_format($available, 0, ',', '.'),
                        number_format($amount, 0, ',', '.'),
                    ),
                ],
            ]);
        }
    }

    private function committedAmount(int $budgetLineId): int
    {
        return (int) BudgetCommitment::query()
            ->where('budget_line_id', $budgetLineId)
            ->where('status', 'active')
            ->sum('amount');
    }

    /**
     * @param  list<int>  $lineIds
     * @return array<int, int>
     */
    private function committedByLineIds(array $lineIds): array
    {
        if ($lineIds === []) {
            return [];
        }

        return BudgetCommitment::query()
            ->select('budget_line_id', DB::raw('SUM(amount) as total'))
            ->whereIn('budget_line_id', $lineIds)
            ->where('status', 'active')
            ->groupBy('budget_line_id')
            ->pluck('total', 'budget_line_id')
            ->map(fn ($v) => (int) $v)
            ->all();
    }

    private function resolveBudgetLine(int $companyId, ?int $departmentId, ?int $outletId): BudgetLine
    {
        $today = now()->toDateString();
        $budget = Budget::query()
            ->where('company_id', $companyId)
            ->where('status', 'active')
            ->whereDate('period_start', '<=', $today)
            ->whereDate('period_end', '>=', $today)
            ->orderByDesc('period_start')
            ->first();

        if (! $budget) {
            throw ValidationException::withMessages([
                'budget' => ['Tidak ada anggaran aktif untuk periode ini.'],
            ]);
        }

        /** @var Collection<int, BudgetLine> $lines */
        $lines = BudgetLine::query()->where('budget_id', $budget->id)->get();

        $matchers = [
            fn () => $departmentId && $outletId
                ? $lines->first(fn (BudgetLine $l) => (int) $l->department_id === $departmentId && (int) $l->outlet_id === $outletId)
                : null,
            fn () => $departmentId
                ? $lines->first(fn (BudgetLine $l) => (int) $l->department_id === $departmentId && $l->outlet_id === null)
                : null,
            fn () => $outletId
                ? $lines->first(fn (BudgetLine $l) => $l->department_id === null && (int) $l->outlet_id === $outletId)
                : null,
            fn () => $lines->first(fn (BudgetLine $l) => $l->department_id === null && $l->outlet_id === null),
        ];

        foreach ($matchers as $pick) {
            $line = $pick();
            if ($line instanceof BudgetLine) {
                return $line;
            }
        }

        throw ValidationException::withMessages([
            'budget' => ['Tidak ada baris anggaran untuk departemen/outlet ini.'],
        ]);
    }

    private function estimateUnitCost(int $productId, int $factorToBase, int $fallbackCostPrice): int
    {
        $row = DB::table('goods_receipt_items as gri')
            ->join('goods_receipts as gr', 'gr.id', '=', 'gri.goods_receipt_id')
            ->where('gri.product_id', $productId)
            ->where('gr.status', 'confirmed')
            ->where('gri.unit_cost', '>', 0)
            ->orderByDesc('gr.id')
            ->first(['gri.unit_cost', 'gri.factor_to_base']);

        if ($row) {
            $factor = max(1, (int) ($row->factor_to_base ?: 1));
            $base = (int) round((int) $row->unit_cost / $factor);

            return $base * max(1, $factorToBase);
        }

        return max(0, $fallbackCostPrice) * max(1, $factorToBase);
    }
}
