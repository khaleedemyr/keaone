<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Contact;
use App\Models\Outlet;
use App\Models\ProcurementContract;
use App\Models\ProcurementContractItem;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProcurementContractService
{
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
        private PurchaseService $purchases,
    ) {}

    public function enabled(?Company $company = null): bool
    {
        return ProcurementSettings::bool('procurement_contract_enabled', $company);
    }

    public function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'contract' => ['Modul kontrak procurement belum diaktifkan.'],
            ]);
        }
    }

    public function create(array $payload, User $user): ProcurementContract
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($payload, $user) {
            $company = CurrentCompany::company();
            abort_unless($company, 422, 'Pilih perusahaan dulu.');

            $this->assertSupplier($company->id, (int) $payload['supplier_id']);
            $outlet = $this->resolveOutletForWrite($payload);
            $warehouseId = $payload['warehouse_id'] ?? $this->inventory->resolveDefaultWarehouse($company->id, $outlet->id)->id;
            $this->assertWarehouse($company->id, (int) $warehouseId);

            $contract = ProcurementContract::query()->create([
                'company_id' => $company->id,
                'outlet_id' => $outlet->id,
                'department_id' => $payload['department_id'] ?? null,
                'warehouse_id' => $warehouseId,
                'user_id' => $user->id,
                'supplier_id' => $payload['supplier_id'],
                'number' => $this->nextNumber('CTR', $company->id),
                'client_uuid' => $payload['client_uuid'],
                'title' => $payload['title'],
                'status' => 'draft',
                'period_start' => $payload['period_start'] ?? null,
                'period_end' => $payload['period_end'] ?? null,
                'note' => $payload['note'] ?? null,
                'total_value' => 0,
            ]);

            $this->syncItems($contract, $payload['items'] ?? []);
            $this->recalcTotals($contract);

            return $this->loadContract($contract->fresh());
        });
    }

    public function update(ProcurementContract $contract, array $payload): ProcurementContract
    {
        $this->assertEnabled();
        $this->assertEditable($contract);

        return DB::transaction(function () use ($contract, $payload) {
            $contract = ProcurementContract::query()->whereKey($contract->id)->lockForUpdate()->firstOrFail();
            $this->assertEditable($contract);

            $updates = [];
            foreach (['title', 'period_start', 'period_end', 'note', 'department_id'] as $key) {
                if (array_key_exists($key, $payload)) {
                    $updates[$key] = $payload[$key];
                }
            }
            if (array_key_exists('warehouse_id', $payload)) {
                $this->assertWarehouse((int) $contract->company_id, (int) $payload['warehouse_id']);
                $updates['warehouse_id'] = $payload['warehouse_id'];
            }
            if (array_key_exists('supplier_id', $payload)) {
                $this->assertSupplier((int) $contract->company_id, (int) $payload['supplier_id']);
                $updates['supplier_id'] = $payload['supplier_id'];
            }
            if ($updates !== []) {
                $contract->update($updates);
            }

            if (array_key_exists('items', $payload)) {
                $this->syncItems($contract, $payload['items']);
                $this->recalcTotals($contract);
            }

            return $this->loadContract($contract->fresh());
        });
    }

    public function activate(ProcurementContract $contract): ProcurementContract
    {
        $this->assertEnabled();

        if ($contract->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya kontrak draft yang bisa diaktifkan.']]);
        }
        if ($contract->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Tambahkan minimal satu item kontrak.']]);
        }

        $contract->update([
            'status' => 'active',
            'activated_at' => now(),
        ]);

        return $this->loadContract($contract->fresh());
    }

    public function close(ProcurementContract $contract): ProcurementContract
    {
        if ($contract->status !== 'active') {
            throw ValidationException::withMessages(['status' => ['Hanya kontrak aktif yang bisa ditutup.']]);
        }

        $contract->update([
            'status' => 'closed',
            'closed_at' => now(),
        ]);

        return $this->loadContract($contract->fresh());
    }

    public function cancel(ProcurementContract $contract): ProcurementContract
    {
        if (! in_array($contract->status, ['draft', 'active'], true)) {
            throw ValidationException::withMessages(['status' => ['Kontrak tidak bisa dibatalkan.']]);
        }

        $contract->update(['status' => 'cancelled']);

        return $this->loadContract($contract->fresh());
    }

    public function releasePo(ProcurementContract $contract, User $user, array $payload): PurchaseOrder
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($contract, $user, $payload) {
            $contract = ProcurementContract::query()->whereKey($contract->id)->lockForUpdate()->firstOrFail();

            if ($contract->status !== 'active') {
                throw ValidationException::withMessages(['status' => ['Kontrak harus aktif untuk release PO.']]);
            }

            $lines = $payload['items'] ?? [];
            if ($lines === []) {
                throw ValidationException::withMessages(['items' => ['Pilih item kontrak untuk release.']]);
            }

            $contractItems = $contract->items()->get()->keyBy('id');
            $poItems = [];

            foreach ($lines as $row) {
                $lineId = (int) ($row['contract_item_id'] ?? 0);
                $qty = (int) ($row['qty'] ?? 0);
                if ($qty < 1 || ! $contractItems->has($lineId)) {
                    continue;
                }

                /** @var ProcurementContractItem $line */
                $line = $contractItems[$lineId];
                $remaining = (int) $line->qty_contracted - (int) $line->qty_released;
                if ($qty > $remaining) {
                    throw ValidationException::withMessages([
                        'items' => ["Qty release melebihi sisa kontrak untuk {$line->name_snapshot}."],
                    ]);
                }

                $poItems[] = [
                    'product_id' => (int) $line->product_id,
                    'qty' => $qty,
                    'unit' => $line->unit,
                    'unit_level' => $line->unit_level,
                    'unit_cost' => (int) $line->unit_cost,
                    'procurement_contract_item_id' => $line->id,
                    'note' => $row['note'] ?? null,
                ];

                $line->update(['qty_released' => (int) $line->qty_released + $qty]);
            }

            if ($poItems === []) {
                throw ValidationException::withMessages(['items' => ['Tidak ada item valid untuk release.']]);
            }

            $po = $this->purchases->createOrder([
                'client_uuid' => $payload['client_uuid'] ?? (string) Str::uuid(),
                'supplier_id' => $contract->supplier_id,
                'warehouse_id' => $contract->warehouse_id,
                'outlet_id' => $contract->outlet_id,
                'department_id' => $contract->department_id,
                'procurement_contract_id' => $contract->id,
                'expected_at' => $payload['expected_at'] ?? null,
                'note' => $payload['note'] ?? ('Release kontrak '.$contract->number),
                'items' => $poItems,
                'approvals' => $payload['approvals'] ?? [],
            ], $user);

            return $po;
        });
    }

    public function loadContract(ProcurementContract $contract): ProcurementContract
    {
        return $contract->load([
            'items.product:id,name,sku',
            'supplier:id,name',
            'user:id,name',
            'outlet:id,name',
            'department:id,name,code',
            'warehouse:id,name',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(ProcurementContract $contract): array
    {
        $contract = $this->loadContract($contract);

        return [
            'id' => $contract->id,
            'number' => $contract->number,
            'client_uuid' => $contract->client_uuid,
            'title' => $contract->title,
            'status' => $contract->status,
            'period_start' => $contract->period_start?->toDateString(),
            'period_end' => $contract->period_end?->toDateString(),
            'total_value' => (int) $contract->total_value,
            'note' => $contract->note,
            'supplier_id' => $contract->supplier_id,
            'supplier' => $contract->supplier?->only(['id', 'name']),
            'outlet_id' => $contract->outlet_id,
            'outlet' => $contract->outlet?->only(['id', 'name']),
            'department_id' => $contract->department_id,
            'department' => $contract->department?->only(['id', 'name', 'code']),
            'warehouse_id' => $contract->warehouse_id,
            'warehouse' => $contract->warehouse?->only(['id', 'name']),
            'user' => $contract->user?->only(['id', 'name']),
            'items' => $contract->items->map(fn (ProcurementContractItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product?->name ?? $item->name_snapshot,
                'sku' => $item->product?->sku,
                'qty_contracted' => (int) $item->qty_contracted,
                'qty_released' => (int) $item->qty_released,
                'qty_remaining' => max(0, (int) $item->qty_contracted - (int) $item->qty_released),
                'unit_cost' => (int) $item->unit_cost,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'note' => $item->note,
            ])->values(),
            'activated_at' => $contract->activated_at?->toIso8601String(),
            'closed_at' => $contract->closed_at?->toIso8601String(),
            'created_at' => $contract->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function syncItems(ProcurementContract $contract, array $items): void
    {
        $contract->items()->delete();

        foreach ($items as $row) {
            $product = Product::query()->findOrFail((int) $row['product_id']);
            $resolved = $this->productUnits->resolveLine(
                $product,
                isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );

            ProcurementContractItem::query()->create([
                'company_id' => $contract->company_id,
                'procurement_contract_id' => $contract->id,
                'product_id' => $product->id,
                'qty_contracted' => (int) $row['qty'],
                'qty_released' => 0,
                'unit_cost' => max(0, (int) ($row['unit_cost'] ?? 0)),
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'note' => $row['note'] ?? null,
            ]);
        }
    }

    private function recalcTotals(ProcurementContract $contract): void
    {
        $total = (int) $contract->items()->selectRaw('SUM(qty_contracted * unit_cost) as total')->value('total');
        $contract->update(['total_value' => $total]);
    }

    private function assertEditable(ProcurementContract $contract): void
    {
        if ($contract->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Kontrak hanya bisa diubah saat draft.']]);
        }
    }

    private function nextNumber(string $prefix, int $companyId): string
    {
        $full = $prefix.'-'.now()->format('ymd').'-';
        $last = ProcurementContract::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('number', 'like', $full.'%')
            ->orderByDesc('number')
            ->lockForUpdate()
            ->value('number');

        $seq = $last ? ((int) substr((string) $last, -3)) + 1 : 1;

        return $full.str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
    }

    private function assertWarehouse(int $companyId, int $warehouseId): void
    {
        $ok = Warehouse::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($warehouseId)
            ->where('is_active', true)
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages(['warehouse_id' => ['Gudang tidak valid.']]);
        }
    }

    private function assertSupplier(int $companyId, int $supplierId): void
    {
        $ok = Contact::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($supplierId)
            ->whereIn('type', ['supplier', 'both'])
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages(['supplier_id' => ['Supplier tidak valid.']]);
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function resolveOutletForWrite(array $payload, ?ProcurementContract $existing = null): Outlet
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        $outletId = $payload['outlet_id'] ?? $existing?->outlet_id ?? CurrentCompany::outlet()?->id;
        abort_unless($outletId, 422, 'Pilih outlet dulu.');

        return Outlet::query()->where('company_id', $company->id)->findOrFail($outletId);
    }
}
