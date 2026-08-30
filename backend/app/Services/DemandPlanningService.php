<?php

namespace App\Services;

use App\Models\Company;
use App\Models\ProcurementForecast;
use App\Models\Product;
use App\Models\PurchaseRequisition;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DemandPlanningService
{
    public function __construct(private PurchaseService $purchases) {}

    public function enabled(?Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_demand_planning_enabled', $company);
    }

    public function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'demand_planning' => ['Demand planning belum diaktifkan di pengaturan procurement.'],
            ]);
        }
    }

    /**
     * @return Collection<int, ProcurementForecast>
     */
    public function generate(?int $warehouseId = null, ?int $monthsAhead = null): Collection
    {
        $this->assertEnabled();
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        if ($this->purchases->purchaseFlow($company) !== 'strict_pr_po_gr') {
            throw ValidationException::withMessages([
                'purchase_flow' => ['Demand planning hanya tersedia pada mode PR → PO → GR.'],
            ]);
        }

        $monthsAhead = max(1, min(6, $monthsAhead ?? 1));
        $from = now()->subMonths(3)->startOfMonth();
        $target = now()->addMonths($monthsAhead);

        $usage = StockMovement::query()
            ->select('product_id', 'warehouse_id', DB::raw('SUM(ABS(qty_change)) as usage_qty'))
            ->where('company_id', $company->id)
            ->where('qty_change', '<', 0)
            ->where('created_at', '>=', $from)
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->groupBy('product_id', 'warehouse_id')
            ->get();

        $created = collect();

        foreach ($usage as $row) {
            $monthlyAvg = max(1, (int) round(((int) $row->usage_qty) / 3));
            $forecastQty = $monthlyAvg * $monthsAhead;

            $product = Product::query()->find($row->product_id);
            if (! $product?->track_stock || ! $product->is_active) {
                continue;
            }

            $forecast = ProcurementForecast::query()->updateOrCreate(
                [
                    'company_id' => $company->id,
                    'product_id' => (int) $row->product_id,
                    'warehouse_id' => $row->warehouse_id,
                    'period_year' => (int) $target->year,
                    'period_month' => (int) $target->month,
                ],
                [
                    'forecast_qty' => $forecastQty,
                    'status' => 'suggested',
                    'note' => 'Rata-rata pemakaian 3 bulan',
                ],
            );

            $created->push($forecast);
        }

        return $created;
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function listForecasts(?int $warehouseId = null): Collection
    {
        $this->assertEnabled();
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        return ProcurementForecast::query()
            ->with(['product:id,name,sku', 'warehouse:id,name'])
            ->where('company_id', $company->id)
            ->where('status', 'suggested')
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->get()
            ->map(fn (ProcurementForecast $row) => [
                'id' => $row->id,
                'product_id' => $row->product_id,
                'product_name' => $row->product?->name,
                'sku' => $row->product?->sku,
                'warehouse_id' => $row->warehouse_id,
                'warehouse_name' => $row->warehouse?->name,
                'period_year' => (int) $row->period_year,
                'period_month' => (int) $row->period_month,
                'forecast_qty' => (int) $row->forecast_qty,
                'status' => $row->status,
                'note' => $row->note,
            ]);
    }

    /**
     * @param  array<int, int>|null  $forecastIds
     */
    public function suggestPr(User $user, ?int $warehouseId = null, ?array $forecastIds = null): PurchaseRequisition
    {
        $forecasts = $this->listForecasts($warehouseId);
        if ($forecastIds !== null && $forecastIds !== []) {
            $forecasts = $forecasts->filter(fn (array $row) => in_array((int) $row['id'], $forecastIds, true));
        }

        if ($forecasts->isEmpty()) {
            throw ValidationException::withMessages(['forecasts' => ['Tidak ada forecast untuk dibuat PR.']]);
        }

        $firstWarehouse = (int) ($forecasts->first()['warehouse_id'] ?? $warehouseId);
        abort_unless($firstWarehouse, 422, 'Warehouse tidak ditemukan.');

        $items = $forecasts->map(fn (array $row) => [
            'product_id' => (int) $row['product_id'],
            'qty' => (int) $row['forecast_qty'],
        ])->values()->all();

        $pr = $this->purchases->createRequisition([
            'client_uuid' => (string) Str::uuid(),
            'warehouse_id' => $firstWarehouse,
            'outlet_id' => CurrentCompany::outlet()?->id,
            'note' => 'Demand planning '.now()->format('Y-m'),
            'items' => $items,
            'approvals' => [],
        ], $user);

        ProcurementForecast::query()
            ->whereIn('id', $forecasts->pluck('id'))
            ->update(['status' => 'converted']);

        return $pr;
    }
}
