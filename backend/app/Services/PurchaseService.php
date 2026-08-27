<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Contact;
use App\Models\GoodsReceipt;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseRequisition;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseService
{
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
    ) {}

    public function purchaseFlow(?Company $company = null): string
    {
        $company ??= CurrentCompany::company();
        $settings = array_merge($company?->defaultSettings() ?? [], $company?->settings ?? []);
        $flow = (string) ($settings['purchase_flow'] ?? 'direct');

        return in_array($flow, ['strict_pr_po_gr', 'po_gr', 'direct'], true) ? $flow : 'direct';
    }

    public function updateCostEnabled(?Company $company = null): bool
    {
        $company ??= CurrentCompany::company();
        $settings = array_merge($company?->defaultSettings() ?? [], $company?->settings ?? []);

        return (bool) ($settings['purchase_update_cost'] ?? true);
    }

    // ─── PR ───────────────────────────────────────────────

    public function createRequisition(array $payload, User $user): PurchaseRequisition
    {
        $existing = PurchaseRequisition::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadPr($existing);
        }

        $flow = $this->purchaseFlow();
        if ($flow === 'direct' || $flow === 'po_gr') {
            throw ValidationException::withMessages([
                'purchase_flow' => ['Mode pembelian saat ini tidak memakai PR.'],
            ]);
        }

        try {
            return DB::transaction(fn () => $this->writeRequisition($payload, $user));
        } catch (UniqueConstraintViolationException) {
            $row = PurchaseRequisition::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadPr($row);
        }
    }

    public function updateRequisition(PurchaseRequisition $pr, array $payload): PurchaseRequisition
    {
        if (! in_array($pr->status, ['draft', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['PR hanya bisa diubah saat draft/rejected.']]);
        }

        return DB::transaction(function () use ($pr, $payload) {
            $pr->update([
                'warehouse_id' => $payload['warehouse_id'] ?? $pr->warehouse_id,
                'needed_at' => $payload['needed_at'] ?? $pr->needed_at,
                'note' => $payload['note'] ?? $pr->note,
                'status' => 'draft',
                'approved_by' => null,
                'approved_at' => null,
            ]);

            if (isset($payload['items'])) {
                $pr->items()->delete();
                $this->attachPrItems($pr, $payload['items']);
            }

            return $this->loadPr($pr->fresh());
        });
    }

    public function submitRequisition(PurchaseRequisition $pr): PurchaseRequisition
    {
        if ($pr->status !== 'draft' && $pr->status !== 'rejected') {
            throw ValidationException::withMessages(['status' => ['PR tidak bisa diajukan.']]);
        }
        if ($pr->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['PR belum punya item.']]);
        }
        $pr->update(['status' => 'submitted']);

        return $this->loadPr($pr->fresh());
    }

    public function approveRequisition(PurchaseRequisition $pr, User $user): PurchaseRequisition
    {
        if ($pr->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya PR yang diajukan yang bisa disetujui.']]);
        }
        $pr->update([
            'status' => 'approved',
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        return $this->loadPr($pr->fresh());
    }

    public function rejectRequisition(PurchaseRequisition $pr, User $user): PurchaseRequisition
    {
        if ($pr->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => ['Hanya PR yang diajukan yang bisa ditolak.']]);
        }
        $pr->update([
            'status' => 'rejected',
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        return $this->loadPr($pr->fresh());
    }

    public function cancelRequisition(PurchaseRequisition $pr): PurchaseRequisition
    {
        if (in_array($pr->status, ['cancelled', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => ['PR tidak bisa dibatalkan.']]);
        }
        $pr->update(['status' => 'cancelled']);

        return $this->loadPr($pr->fresh());
    }

    // ─── PO ───────────────────────────────────────────────

    public function createOrder(array $payload, User $user): PurchaseOrder
    {
        $existing = PurchaseOrder::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadPo($existing);
        }

        $flow = $this->purchaseFlow();
        if ($flow === 'direct') {
            throw ValidationException::withMessages([
                'purchase_flow' => ['Mode pembelian langsung tidak memakai PO. Gunakan penerimaan barang.'],
            ]);
        }

        try {
            return DB::transaction(fn () => $this->writeOrder($payload, $user, $flow));
        } catch (UniqueConstraintViolationException) {
            $row = PurchaseOrder::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadPo($row);
        }
    }

    public function updateOrder(PurchaseOrder $po, array $payload): PurchaseOrder
    {
        if ($po->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['PO hanya bisa diubah saat draft.']]);
        }

        return DB::transaction(function () use ($po, $payload) {
            $po->update([
                'supplier_id' => $payload['supplier_id'] ?? $po->supplier_id,
                'warehouse_id' => $payload['warehouse_id'] ?? $po->warehouse_id,
                'expected_at' => $payload['expected_at'] ?? $po->expected_at,
                'note' => $payload['note'] ?? $po->note,
            ]);

            if (isset($payload['items'])) {
                $po->items()->delete();
                $totals = $this->attachPoItems($po, $payload['items']);
                $po->update($totals);
            }

            return $this->loadPo($po->fresh());
        });
    }

    public function orderPurchaseOrder(PurchaseOrder $po): PurchaseOrder
    {
        if ($po->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['PO tidak bisa dipesan.']]);
        }
        if ($po->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['PO belum punya item.']]);
        }
        $po->update([
            'status' => 'ordered',
            'ordered_at' => now()->toDateString(),
        ]);

        return $this->loadPo($po->fresh());
    }

    public function cancelOrder(PurchaseOrder $po): PurchaseOrder
    {
        if (! in_array($po->status, ['draft', 'ordered'], true)) {
            throw ValidationException::withMessages(['status' => ['PO tidak bisa dibatalkan.']]);
        }
        if ((int) $po->items()->sum('qty_received') > 0) {
            throw ValidationException::withMessages(['status' => ['PO sudah ada penerimaan.']]);
        }
        $po->update(['status' => 'cancelled']);

        return $this->loadPo($po->fresh());
    }

    // ─── GR ───────────────────────────────────────────────

    public function createReceipt(array $payload, User $user): GoodsReceipt
    {
        $existing = GoodsReceipt::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadGr($existing);
        }

        $flow = $this->purchaseFlow();

        try {
            return DB::transaction(fn () => $this->writeReceipt($payload, $user, $flow));
        } catch (UniqueConstraintViolationException) {
            $row = GoodsReceipt::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadGr($row);
        }
    }

    public function updateReceipt(GoodsReceipt $gr, array $payload): GoodsReceipt
    {
        if ($gr->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Penerimaan hanya bisa diubah saat draft.']]);
        }

        return DB::transaction(function () use ($gr, $payload) {
            $gr->update([
                'supplier_id' => $payload['supplier_id'] ?? $gr->supplier_id,
                'warehouse_id' => $payload['warehouse_id'] ?? $gr->warehouse_id,
                'note' => $payload['note'] ?? $gr->note,
            ]);

            if (isset($payload['items'])) {
                $gr->items()->delete();
                $totals = $this->attachGrItems($gr, $payload['items']);
                $gr->update($totals);
            }

            return $this->loadGr($gr->fresh());
        });
    }

    public function confirmReceipt(GoodsReceipt $gr): GoodsReceipt
    {
        if ($gr->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Penerimaan tidak bisa dikonfirmasi.']]);
        }
        if ($gr->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Penerimaan belum punya item.']]);
        }

        return DB::transaction(function () use ($gr) {
            $gr = GoodsReceipt::query()->whereKey($gr->id)->lockForUpdate()->firstOrFail();
            $gr->load(['items', 'purchaseOrder.items']);

            $flow = $this->purchaseFlow();
            if ($flow !== 'direct' && ! $gr->purchase_order_id) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => ['Mode saat ini mewajibkan PO pada penerimaan.'],
                ]);
            }
            if ($flow === 'direct' && $gr->purchase_order_id) {
                // allow linking but not required
            }

            $company = Company::query()->findOrFail($gr->company_id);
            $updateCost = $this->updateCostEnabled($company);

            foreach ($gr->items as $item) {
                $product = Product::query()->withoutGlobalScopes()->find($item->product_id);
                $factor = max(1, (int) ($item->factor_to_base ?: 1));
                $baseQty = $this->productUnits->toBaseQty((int) $item->qty, $factor);

                if ($product?->track_stock) {
                    $this->inventory->adjust(
                        (int) $gr->company_id,
                        (int) $gr->warehouse_id,
                        (int) $item->product_id,
                        $baseQty,
                        'purchase',
                        'goods_receipt',
                        (int) $gr->id,
                        'Penerimaan '.$gr->number,
                        (int) $gr->outlet_id,
                        [
                            'qty_input' => (int) $item->qty,
                            'unit_level' => $item->unit_level,
                            'unit' => $item->unit,
                            'factor_to_base' => $factor,
                        ],
                    );
                }
                if ($updateCost && $product && (int) $item->unit_cost > 0) {
                    $costPerBase = (int) round((int) $item->unit_cost / $factor);
                    if ($costPerBase > 0) {
                        $product->forceFill(['cost_price' => $costPerBase])->save();
                    }
                }

                if ($item->purchase_order_item_id) {
                    $poItem = PurchaseOrderItem::query()->whereKey($item->purchase_order_item_id)->lockForUpdate()->first();
                    if ($poItem) {
                        $poFactor = max(1, (int) ($poItem->factor_to_base ?: 1));
                        $addInPoUnit = (int) round($baseQty / $poFactor);
                        if ($addInPoUnit < 1) {
                            throw ValidationException::withMessages([
                                'items' => ["Qty terima tidak cocok dengan satuan PO untuk {$item->name_snapshot}."],
                            ]);
                        }
                        $poItem->qty_received = (int) $poItem->qty_received + $addInPoUnit;
                        if ($poItem->qty_received > $poItem->qty) {
                            throw ValidationException::withMessages([
                                'items' => ["Qty terima melebihi PO untuk {$item->name_snapshot}."],
                            ]);
                        }
                        $poItem->save();
                    }
                }
            }

            if ($gr->purchase_order_id) {
                $this->refreshPoStatus($gr->purchase_order_id);
            }

            $gr->update([
                'status' => 'confirmed',
                'received_at' => now(),
            ]);

            return $this->loadGr($gr->fresh());
        });
    }

    public function cancelReceipt(GoodsReceipt $gr): GoodsReceipt
    {
        if ($gr->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dibatalkan.']]);
        }
        $gr->update(['status' => 'cancelled']);

        return $this->loadGr($gr->fresh());
    }

    // ─── Serialize ────────────────────────────────────────

    public function serializePr(PurchaseRequisition $pr): array
    {
        $pr = $this->loadPr($pr);

        return [
            'id' => $pr->id,
            'number' => $pr->number,
            'client_uuid' => $pr->client_uuid,
            'status' => $pr->status,
            'needed_at' => $pr->needed_at?->toDateString(),
            'note' => $pr->note,
            'outlet_id' => $pr->outlet_id,
            'warehouse_id' => $pr->warehouse_id,
            'warehouse' => $pr->warehouse?->only(['id', 'name']),
            'user' => $pr->user?->only(['id', 'name']),
            'approver' => $pr->approver?->only(['id', 'name']),
            'approved_at' => $pr->approved_at?->toIso8601String(),
            'created_at' => $pr->created_at?->toIso8601String(),
            'items' => $pr->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->product?->only(['id', 'name', 'sku', 'unit', 'cost_price']),
                'qty' => $item->qty,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'factor_to_base' => (int) ($item->factor_to_base ?: 1),
                'name_snapshot' => $item->name_snapshot,
                'note' => $item->note,
            ])->values(),
        ];
    }

    public function serializePo(PurchaseOrder $po): array
    {
        $po = $this->loadPo($po);

        return [
            'id' => $po->id,
            'number' => $po->number,
            'client_uuid' => $po->client_uuid,
            'status' => $po->status,
            'ordered_at' => $po->ordered_at?->toDateString(),
            'expected_at' => $po->expected_at?->toDateString(),
            'subtotal' => $po->subtotal,
            'tax' => $po->tax,
            'total' => $po->total,
            'note' => $po->note,
            'outlet_id' => $po->outlet_id,
            'warehouse_id' => $po->warehouse_id,
            'warehouse' => $po->warehouse?->only(['id', 'name']),
            'supplier_id' => $po->supplier_id,
            'supplier' => $po->supplier?->only(['id', 'name', 'phone']),
            'purchase_requisition_id' => $po->purchase_requisition_id,
            'requisition' => $po->requisition?->only(['id', 'number', 'status']),
            'user' => $po->user?->only(['id', 'name']),
            'created_at' => $po->created_at?->toIso8601String(),
            'items' => $po->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->product?->only(['id', 'name', 'sku', 'unit', 'cost_price']),
                'qty' => $item->qty,
                'qty_received' => $item->qty_received,
                'qty_remaining' => max(0, (int) $item->qty - (int) $item->qty_received),
                'unit_cost' => $item->unit_cost,
                'total' => $item->total,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'factor_to_base' => (int) ($item->factor_to_base ?: 1),
                'name_snapshot' => $item->name_snapshot,
                'note' => $item->note,
                'purchase_requisition_item_id' => $item->purchase_requisition_item_id,
            ])->values(),
        ];
    }

    public function serializeGr(GoodsReceipt $gr): array
    {
        $gr = $this->loadGr($gr);

        return [
            'id' => $gr->id,
            'number' => $gr->number,
            'client_uuid' => $gr->client_uuid,
            'status' => $gr->status,
            'received_at' => $gr->received_at?->toIso8601String(),
            'subtotal' => $gr->subtotal,
            'tax' => $gr->tax,
            'total' => $gr->total,
            'note' => $gr->note,
            'outlet_id' => $gr->outlet_id,
            'warehouse_id' => $gr->warehouse_id,
            'warehouse' => $gr->warehouse?->only(['id', 'name']),
            'supplier_id' => $gr->supplier_id,
            'supplier' => $gr->supplier?->only(['id', 'name', 'phone']),
            'purchase_order_id' => $gr->purchase_order_id,
            'purchase_order' => $gr->purchaseOrder?->only(['id', 'number', 'status']),
            'user' => $gr->user?->only(['id', 'name']),
            'created_at' => $gr->created_at?->toIso8601String(),
            'is_direct' => $gr->purchase_order_id === null,
            'items' => $gr->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->product?->only(['id', 'name', 'sku', 'unit', 'cost_price']),
                'qty' => $item->qty,
                'unit_cost' => $item->unit_cost,
                'total' => $item->total,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'factor_to_base' => (int) ($item->factor_to_base ?: 1),
                'name_snapshot' => $item->name_snapshot,
                'note' => $item->note,
                'purchase_order_item_id' => $item->purchase_order_item_id,
            ])->values(),
        ];
    }

    // ─── Writers ──────────────────────────────────────────

    private function writeRequisition(array $payload, User $user): PurchaseRequisition
    {
        $company = CurrentCompany::company();
        $outlet = CurrentCompany::outlet();
        abort_unless($company && $outlet, 422, 'Pilih perusahaan/outlet dulu.');

        $warehouseId = $payload['warehouse_id'] ?? $this->inventory->resolveDefaultWarehouse($company->id, $outlet->id)->id;
        $this->assertWarehouse($company->id, (int) $warehouseId);

        $pr = PurchaseRequisition::query()->create([
            'company_id' => $company->id,
            'outlet_id' => $outlet->id,
            'warehouse_id' => $warehouseId,
            'user_id' => $user->id,
            'number' => $this->nextNumber('PR', $company->id),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'needed_at' => $payload['needed_at'] ?? null,
            'note' => $payload['note'] ?? null,
        ]);

        $this->attachPrItems($pr, $payload['items'] ?? []);

        return $this->loadPr($pr->fresh());
    }

    private function writeOrder(array $payload, User $user, string $flow): PurchaseOrder
    {
        $company = CurrentCompany::company();
        $outlet = CurrentCompany::outlet();
        abort_unless($company && $outlet, 422, 'Pilih perusahaan/outlet dulu.');

        $this->assertSupplier($company->id, (int) $payload['supplier_id']);

        $prId = $payload['purchase_requisition_id'] ?? null;
        $pr = null;
        if ($flow === 'strict_pr_po_gr') {
            if (! $prId) {
                throw ValidationException::withMessages([
                    'purchase_requisition_id' => ['Mode ketat mewajibkan PR yang sudah disetujui.'],
                ]);
            }
            $pr = PurchaseRequisition::query()->findOrFail($prId);
            if ($pr->status !== 'approved') {
                throw ValidationException::withMessages([
                    'purchase_requisition_id' => ['PR harus berstatus approved.'],
                ]);
            }
        } elseif ($prId) {
            $pr = PurchaseRequisition::query()->findOrFail($prId);
            if ($pr->status !== 'approved') {
                throw ValidationException::withMessages([
                    'purchase_requisition_id' => ['PR harus berstatus approved.'],
                ]);
            }
        }

        $warehouseId = $payload['warehouse_id']
            ?? ($pr?->warehouse_id)
            ?? $this->inventory->resolveDefaultWarehouse($company->id, $outlet->id)->id;
        $this->assertWarehouse($company->id, (int) $warehouseId);

        $po = PurchaseOrder::query()->create([
            'company_id' => $company->id,
            'outlet_id' => $outlet->id,
            'warehouse_id' => $warehouseId,
            'user_id' => $user->id,
            'supplier_id' => $payload['supplier_id'],
            'purchase_requisition_id' => $prId,
            'number' => $this->nextNumber('PO', $company->id),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'expected_at' => $payload['expected_at'] ?? null,
            'note' => $payload['note'] ?? null,
            'subtotal' => 0,
            'tax' => 0,
            'total' => 0,
        ]);

        $items = $payload['items'] ?? null;
        if ((! $items || $items === []) && $prId) {
            $items = PurchaseRequisition::query()->findOrFail($prId)->items->map(fn ($item) => [
                'product_id' => $item->product_id,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'unit_cost' => (int) ($item->product?->cost_price ?? 0) * max(1, (int) ($item->factor_to_base ?: 1)),
                'purchase_requisition_item_id' => $item->id,
                'note' => $item->note,
            ])->all();
        }

        $totals = $this->attachPoItems($po, $items ?? []);
        $po->update($totals);

        return $this->loadPo($po->fresh());
    }

    private function writeReceipt(array $payload, User $user, string $flow): GoodsReceipt
    {
        $company = CurrentCompany::company();
        $outlet = CurrentCompany::outlet();
        abort_unless($company && $outlet, 422, 'Pilih perusahaan/outlet dulu.');

        $poId = $payload['purchase_order_id'] ?? null;
        $po = null;

        if ($flow === 'direct') {
            // PO optional
        } else {
            if (! $poId) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => ['Mode saat ini mewajibkan PO.'],
                ]);
            }
        }

        if ($poId) {
            $po = PurchaseOrder::query()->with('items')->findOrFail($poId);
            if (! in_array($po->status, ['ordered', 'partial'], true)) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => ['PO harus berstatus ordered/partial.'],
                ]);
            }
            if ($flow === 'strict_pr_po_gr' && ! $po->purchase_requisition_id) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => ['Mode ketat mewajibkan PO yang berasal dari PR.'],
                ]);
            }
        }

        $supplierId = $payload['supplier_id'] ?? $po?->supplier_id;
        if ($supplierId) {
            $this->assertSupplier($company->id, (int) $supplierId);
        } elseif ($flow === 'direct') {
            throw ValidationException::withMessages([
                'supplier_id' => ['Supplier wajib diisi.'],
            ]);
        }

        $warehouseId = $payload['warehouse_id']
            ?? $po?->warehouse_id
            ?? $this->inventory->resolveDefaultWarehouse($company->id, $outlet->id)->id;
        $this->assertWarehouse($company->id, (int) $warehouseId);

        $gr = GoodsReceipt::query()->create([
            'company_id' => $company->id,
            'outlet_id' => $outlet->id,
            'warehouse_id' => $warehouseId,
            'user_id' => $user->id,
            'supplier_id' => $supplierId,
            'purchase_order_id' => $poId,
            'number' => $this->nextNumber('GR', $company->id),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'note' => $payload['note'] ?? null,
            'subtotal' => 0,
            'tax' => 0,
            'total' => 0,
        ]);

        $items = $payload['items'] ?? null;
        if ((! $items || $items === []) && $po) {
            $items = $po->items
                ->filter(fn ($item) => (int) $item->qty - (int) $item->qty_received > 0)
                ->map(fn ($item) => [
                    'product_id' => $item->product_id,
                    'qty' => (int) $item->qty - (int) $item->qty_received,
                    'unit_cost' => $item->unit_cost,
                    'unit' => $item->unit,
                    'unit_level' => $item->unit_level,
                    'purchase_order_item_id' => $item->id,
                    'note' => $item->note,
                ])->values()->all();
        }

        $totals = $this->attachGrItems($gr, $items ?? []);
        $gr->update($totals);

        return $this->loadGr($gr->fresh());
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function attachPrItems(PurchaseRequisition $pr, array $items): void
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item.']]);
        }

        foreach ($items as $row) {
            $product = Product::query()->findOrFail($row['product_id']);
            $resolved = $this->productUnits->resolveLine(
                $product,
                isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );
            $pr->items()->create([
                'company_id' => $pr->company_id,
                'product_id' => $product->id,
                'qty' => (int) $row['qty'],
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'note' => $row['note'] ?? null,
            ]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return array{subtotal: int, tax: int, total: int}
     */
    private function attachPoItems(PurchaseOrder $po, array $items): array
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item.']]);
        }

        $subtotal = 0;
        foreach ($items as $row) {
            $product = Product::query()->findOrFail($row['product_id']);
            $resolved = $this->productUnits->resolveLine(
                $product,
                isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );
            $qty = (int) $row['qty'];
            $unitCost = (int) ($row['unit_cost'] ?? $product->cost_price ?? 0);
            $lineTotal = $qty * $unitCost;
            $subtotal += $lineTotal;

            $po->items()->create([
                'company_id' => $po->company_id,
                'product_id' => $product->id,
                'purchase_requisition_item_id' => $row['purchase_requisition_item_id'] ?? null,
                'qty' => $qty,
                'qty_received' => 0,
                'unit_cost' => $unitCost,
                'total' => $lineTotal,
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'note' => $row['note'] ?? null,
            ]);
        }

        return ['subtotal' => $subtotal, 'tax' => 0, 'total' => $subtotal];
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return array{subtotal: int, tax: int, total: int}
     */
    private function attachGrItems(GoodsReceipt $gr, array $items): array
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item.']]);
        }

        $subtotal = 0;
        foreach ($items as $row) {
            $product = Product::query()->findOrFail($row['product_id']);
            $resolved = $this->productUnits->resolveLine(
                $product,
                isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );
            $qty = (int) $row['qty'];
            $unitCost = (int) ($row['unit_cost'] ?? $product->cost_price ?? 0);
            $lineTotal = $qty * $unitCost;
            $subtotal += $lineTotal;

            $gr->items()->create([
                'company_id' => $gr->company_id,
                'product_id' => $product->id,
                'purchase_order_item_id' => $row['purchase_order_item_id'] ?? null,
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'total' => $lineTotal,
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'note' => $row['note'] ?? null,
            ]);
        }

        return ['subtotal' => $subtotal, 'tax' => 0, 'total' => $subtotal];
    }

    private function refreshPoStatus(int $poId): void
    {
        $po = PurchaseOrder::query()->with('items')->whereKey($poId)->lockForUpdate()->first();
        if (! $po || $po->status === 'cancelled') {
            return;
        }

        $allReceived = $po->items->every(fn ($item) => (int) $item->qty_received >= (int) $item->qty);
        $anyReceived = $po->items->contains(fn ($item) => (int) $item->qty_received > 0);

        $po->update([
            'status' => $allReceived ? 'received' : ($anyReceived ? 'partial' : $po->status),
        ]);
    }

    private function nextNumber(string $prefix, int $companyId): string
    {
        $full = $prefix.'-'.now()->format('ymd').'-';
        $model = match ($prefix) {
            'PR' => PurchaseRequisition::class,
            'PO' => PurchaseOrder::class,
            default => GoodsReceipt::class,
        };

        $last = $model::query()
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

    private function loadPr(PurchaseRequisition $pr): PurchaseRequisition
    {
        return $pr->load([
            'items.product:id,name,sku,unit,cost_price',
            'warehouse:id,name',
            'user:id,name',
            'approver:id,name',
        ]);
    }

    private function loadPo(PurchaseOrder $po): PurchaseOrder
    {
        return $po->load([
            'items.product:id,name,sku,unit,cost_price',
            'warehouse:id,name',
            'supplier:id,name,phone',
            'requisition:id,number,status',
            'user:id,name',
        ]);
    }

    private function loadGr(GoodsReceipt $gr): GoodsReceipt
    {
        return $gr->load([
            'items.product:id,name,sku,unit,cost_price',
            'warehouse:id,name',
            'supplier:id,name,phone',
            'purchaseOrder:id,number,status',
            'user:id,name',
        ]);
    }
}
