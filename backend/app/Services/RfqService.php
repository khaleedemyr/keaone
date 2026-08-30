<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Contact;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\PurchaseRequisition;
use App\Models\Rfq;
use App\Models\RfqItem;
use App\Models\RfqSupplier;
use App\Models\User;
use App\Models\VendorQuote;
use App\Models\VendorQuoteItem;
use App\Models\Warehouse;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RfqService
{
    public function __construct(
        private InventoryService $inventory,
        private ProductUnitService $productUnits,
        private PurchaseService $purchases,
    ) {}

    public function enabled(?Company $company = null): bool
    {
        return ProcurementSettings::rfqEnabled($company);
    }

    public function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'rfq' => ['Modul RFQ belum diaktifkan di pengaturan procurement.'],
            ]);
        }
    }

    public function create(array $payload, User $user): Rfq
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($payload, $user) {
            $company = CurrentCompany::company();
            abort_unless($company, 422, 'Pilih perusahaan dulu.');

            $outlet = $this->resolveOutletForWrite($payload);
            $departmentId = $this->resolveDepartmentId($payload, $user);
            $warehouseId = $payload['warehouse_id'] ?? $this->inventory->resolveDefaultWarehouse($company->id, $outlet->id)->id;
            $this->assertWarehouse($company->id, (int) $warehouseId);

            $rfq = Rfq::query()->create([
                'company_id' => $company->id,
                'outlet_id' => $outlet->id,
                'department_id' => $departmentId,
                'warehouse_id' => $warehouseId,
                'user_id' => $user->id,
                'number' => $this->nextNumber('RFQ', $company->id),
                'client_uuid' => $payload['client_uuid'],
                'title' => $payload['title'],
                'status' => 'draft',
                'due_at' => $payload['due_at'] ?? null,
                'note' => $payload['note'] ?? null,
            ]);

            $this->syncItems($rfq, $payload['items'] ?? []);
            $this->syncSuppliers($rfq, $payload['supplier_ids'] ?? []);

            return $this->loadRfq($rfq->fresh());
        });
    }

    public function update(Rfq $rfq, array $payload): Rfq
    {
        $this->assertEnabled();
        $this->assertEditable($rfq);

        return DB::transaction(function () use ($rfq, $payload) {
            $rfq = Rfq::query()->whereKey($rfq->id)->lockForUpdate()->firstOrFail();
            $this->assertEditable($rfq);

            $updates = [];
            if (array_key_exists('title', $payload)) {
                $updates['title'] = $payload['title'];
            }
            if (array_key_exists('due_at', $payload)) {
                $updates['due_at'] = $payload['due_at'];
            }
            if (array_key_exists('note', $payload)) {
                $updates['note'] = $payload['note'];
            }
            if (array_key_exists('warehouse_id', $payload)) {
                $this->assertWarehouse((int) $rfq->company_id, (int) $payload['warehouse_id']);
                $updates['warehouse_id'] = $payload['warehouse_id'];
            }
            if (array_key_exists('outlet_id', $payload)) {
                $outlet = $this->resolveOutletForWrite($payload, $rfq);
                $updates['outlet_id'] = $outlet->id;
            }
            if (array_key_exists('department_id', $payload)) {
                $updates['department_id'] = $payload['department_id'] ?: null;
            }

            if ($updates !== []) {
                $rfq->update($updates);
            }

            if (array_key_exists('items', $payload)) {
                $this->syncItems($rfq, $payload['items']);
            }
            if (array_key_exists('supplier_ids', $payload)) {
                $this->syncSuppliers($rfq, $payload['supplier_ids']);
            }

            return $this->loadRfq($rfq->fresh());
        });
    }

    public function delete(Rfq $rfq): void
    {
        $this->assertEnabled();
        $this->assertEditable($rfq);

        if ($rfq->requisitions()->exists()) {
            throw ValidationException::withMessages([
                'rfq' => ['RFQ sudah dipakai PR dan tidak bisa dihapus.'],
            ]);
        }

        $rfq->delete();
    }

    public function send(Rfq $rfq): Rfq
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($rfq) {
            $rfq = Rfq::query()->whereKey($rfq->id)->lockForUpdate()->firstOrFail();
            if ($rfq->status !== 'draft') {
                throw ValidationException::withMessages(['status' => ['RFQ tidak bisa dikirim.']]);
            }
            if ($rfq->items()->count() === 0) {
                throw ValidationException::withMessages(['items' => ['RFQ belum punya item.']]);
            }
            if ($rfq->suppliers()->count() === 0) {
                throw ValidationException::withMessages(['supplier_ids' => ['Pilih minimal satu supplier.']]);
            }

            $rfq->update(['status' => 'open']);
            $rfq->suppliers()->update(['invited_at' => now()]);

            return $this->loadRfq($rfq->fresh());
        });
    }

    public function close(Rfq $rfq): Rfq
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($rfq) {
            $rfq = Rfq::query()->whereKey($rfq->id)->lockForUpdate()->firstOrFail();
            if (! in_array($rfq->status, ['open', 'awarded'], true)) {
                throw ValidationException::withMessages(['status' => ['RFQ tidak bisa ditutup.']]);
            }

            $rfq->update([
                'status' => 'closed',
                'closed_at' => now(),
            ]);

            return $this->loadRfq($rfq->fresh());
        });
    }

    public function cancel(Rfq $rfq): Rfq
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($rfq) {
            $rfq = Rfq::query()->whereKey($rfq->id)->lockForUpdate()->firstOrFail();
            if (! in_array($rfq->status, ['draft', 'open'], true)) {
                throw ValidationException::withMessages(['status' => ['RFQ tidak bisa dibatalkan.']]);
            }

            $rfq->update(['status' => 'cancelled']);

            return $this->loadRfq($rfq->fresh());
        });
    }

    public function upsertQuote(Rfq $rfq, int $supplierId, array $payload): VendorQuote
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($rfq, $supplierId, $payload) {
            $rfq = Rfq::query()->whereKey($rfq->id)->lockForUpdate()->firstOrFail();
            if (! in_array($rfq->status, ['open', 'awarded'], true)) {
                throw ValidationException::withMessages(['status' => ['Quote hanya bisa diinput saat RFQ terbuka.']]);
            }

            $this->assertSupplierInvited($rfq, $supplierId);

            $quote = VendorQuote::query()->firstOrCreate(
                [
                    'rfq_id' => $rfq->id,
                    'supplier_id' => $supplierId,
                ],
                [
                    'company_id' => $rfq->company_id,
                    'number' => $this->nextQuoteNumber($rfq),
                    'client_uuid' => $payload['client_uuid'] ?? (string) Str::uuid(),
                    'status' => 'draft',
                ],
            );

            if ($quote->status === 'selected') {
                throw ValidationException::withMessages(['quote' => ['Quote pemenang tidak bisa diubah.']]);
            }

            if (array_key_exists('note', $payload)) {
                $quote->note = $payload['note'];
            }
            if (array_key_exists('lead_days', $payload)) {
                $quote->lead_days = $payload['lead_days'] !== null ? (int) $payload['lead_days'] : null;
            }

            $this->syncQuoteItems($rfq, $quote, $payload['items'] ?? []);
            $this->recalcQuoteTotals($quote);

            $quote->save();

            return $quote->fresh()->load(['supplier:id,name', 'items.rfqItem']);
        });
    }

    public function submitQuote(VendorQuote $quote): VendorQuote
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($quote) {
            $quote = VendorQuote::query()->whereKey($quote->id)->lockForUpdate()->firstOrFail();
            if ($quote->status !== 'draft') {
                throw ValidationException::withMessages(['status' => ['Quote tidak bisa diajukan.']]);
            }
            if ($quote->items()->count() === 0) {
                throw ValidationException::withMessages(['items' => ['Quote belum punya harga item.']]);
            }

            $quote->update([
                'status' => 'submitted',
                'quoted_at' => now(),
            ]);

            return $quote->fresh()->load(['supplier:id,name', 'items.rfqItem']);
        });
    }

    public function selectWinner(Rfq $rfq, int $vendorQuoteId): Rfq
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($rfq, $vendorQuoteId) {
            $rfq = Rfq::query()->whereKey($rfq->id)->lockForUpdate()->firstOrFail();
            if ($rfq->status !== 'open') {
                throw ValidationException::withMessages(['status' => ['Pemenang hanya bisa dipilih saat RFQ terbuka.']]);
            }

            $quote = VendorQuote::query()
                ->where('rfq_id', $rfq->id)
                ->whereKey($vendorQuoteId)
                ->firstOrFail();

            if ($quote->status !== 'submitted') {
                throw ValidationException::withMessages(['quote' => ['Quote belum diajukan supplier.']]);
            }

            VendorQuote::query()
                ->where('rfq_id', $rfq->id)
                ->whereKeyNot($quote->id)
                ->where('status', 'submitted')
                ->update(['status' => 'rejected']);

            $quote->update(['status' => 'selected']);

            $rfq->update([
                'status' => 'awarded',
                'winner_vendor_quote_id' => $quote->id,
                'awarded_at' => now(),
            ]);

            return $this->loadRfq($rfq->fresh());
        });
    }

    public function createPrFromRfq(Rfq $rfq, User $user, array $payload): PurchaseRequisition
    {
        $this->assertEnabled();

        return DB::transaction(function () use ($rfq, $user, $payload) {
            $rfq = Rfq::query()->whereKey($rfq->id)->lockForUpdate()->firstOrFail();

            if (! in_array($rfq->status, ['awarded', 'closed'], true) || ! $rfq->winner_vendor_quote_id) {
                throw ValidationException::withMessages(['rfq' => ['RFQ belum punya quote pemenang.']]);
            }

            if ($rfq->requisitions()->exists()) {
                throw ValidationException::withMessages(['rfq' => ['PR dari RFQ ini sudah dibuat.']]);
            }

            $quote = VendorQuote::query()
                ->with(['items.rfqItem'])
                ->whereKey($rfq->winner_vendor_quote_id)
                ->firstOrFail();

            $items = $quote->items->map(fn (VendorQuoteItem $row) => [
                'product_id' => (int) $row->rfqItem->product_id,
                'qty' => (int) $row->qty,
                'unit' => $row->rfqItem->unit,
                'unit_level' => $row->rfqItem->unit_level,
                'note' => $row->note,
            ])->values()->all();

            if ($items === []) {
                throw ValidationException::withMessages(['items' => ['Quote pemenang tidak punya item.']]);
            }

            $pr = $this->purchases->createRequisition([
                'client_uuid' => $payload['client_uuid'],
                'warehouse_id' => $rfq->warehouse_id,
                'outlet_id' => $rfq->outlet_id,
                'department_id' => $rfq->department_id,
                'needed_at' => $payload['needed_at'] ?? $rfq->due_at?->toDateString(),
                'note' => $payload['note'] ?? ('Dari RFQ '.$rfq->number),
                'items' => $items,
                'approvals' => $payload['approvals'] ?? [],
            ], $user);

            $pr->update([
                'rfq_id' => $rfq->id,
                'vendor_quote_id' => $quote->id,
            ]);

            return $pr->fresh();
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(Rfq $rfq, bool $withComparison = false): array
    {
        $rfq = $this->loadRfq($rfq);

        $data = [
            'id' => $rfq->id,
            'number' => $rfq->number,
            'client_uuid' => $rfq->client_uuid,
            'title' => $rfq->title,
            'status' => $rfq->status,
            'due_at' => $rfq->due_at?->toDateString(),
            'note' => $rfq->note,
            'outlet_id' => $rfq->outlet_id,
            'outlet' => $rfq->outlet?->only(['id', 'name']),
            'department_id' => $rfq->department_id,
            'department' => $rfq->department?->only(['id', 'name', 'code']),
            'warehouse_id' => $rfq->warehouse_id,
            'warehouse' => $rfq->warehouse?->only(['id', 'name']),
            'user' => $rfq->user?->only(['id', 'name']),
            'winner_vendor_quote_id' => $rfq->winner_vendor_quote_id,
            'winner_quote' => $rfq->winnerQuote?->load('supplier:id,name')?->only(['id', 'number', 'status', 'total', 'supplier']),
            'closed_at' => $rfq->closed_at?->toIso8601String(),
            'awarded_at' => $rfq->awarded_at?->toIso8601String(),
            'created_at' => $rfq->created_at?->toIso8601String(),
            'has_purchase_requisition' => $rfq->relationLoaded('requisitions')
                ? $rfq->requisitions->isNotEmpty()
                : $rfq->requisitions()->exists(),
            'items' => $rfq->items->map(fn (RfqItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->product?->only(['id', 'name', 'sku']),
                'name_snapshot' => $item->name_snapshot,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'unit_level' => $item->unit_level,
                'factor_to_base' => $item->factor_to_base,
                'spec_note' => $item->spec_note,
                'note' => $item->note,
            ])->values(),
            'suppliers' => $rfq->suppliers->map(fn (RfqSupplier $row) => [
                'id' => $row->id,
                'supplier_id' => $row->supplier_id,
                'supplier' => $row->supplier?->only(['id', 'name']),
                'invited_at' => $row->invited_at?->toIso8601String(),
            ])->values(),
            'quotes' => $rfq->quotes->map(fn (VendorQuote $quote) => $this->serializeQuote($quote))->values(),
        ];

        if ($withComparison) {
            $data['comparison'] = $this->buildComparison($rfq);
        }

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeQuote(VendorQuote $quote): array
    {
        $quote->loadMissing(['supplier:id,name', 'items.rfqItem']);

        return [
            'id' => $quote->id,
            'number' => $quote->number,
            'client_uuid' => $quote->client_uuid,
            'status' => $quote->status,
            'supplier_id' => $quote->supplier_id,
            'supplier' => $quote->supplier?->only(['id', 'name']),
            'subtotal' => $quote->subtotal,
            'tax' => $quote->tax,
            'total' => $quote->total,
            'note' => $quote->note,
            'lead_days' => $quote->lead_days,
            'quoted_at' => $quote->quoted_at?->toIso8601String(),
            'items' => $quote->items->map(fn (VendorQuoteItem $row) => [
                'id' => $row->id,
                'rfq_item_id' => $row->rfq_item_id,
                'unit_cost' => $row->unit_cost,
                'qty' => $row->qty,
                'total' => $row->total,
                'lead_days' => $row->lead_days,
                'note' => $row->note,
            ])->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function buildComparison(Rfq $rfq): array
    {
        $rfq = $this->loadRfq($rfq);
        $quotes = $rfq->quotes->filter(fn (VendorQuote $q) => in_array($q->status, ['submitted', 'selected'], true));

        $rows = $rfq->items->map(function (RfqItem $item) use ($quotes) {
            $cells = $quotes->map(function (VendorQuote $quote) use ($item) {
                $line = $quote->items->firstWhere('rfq_item_id', $item->id);

                return [
                    'vendor_quote_id' => $quote->id,
                    'supplier_id' => $quote->supplier_id,
                    'supplier_name' => $quote->supplier?->name,
                    'unit_cost' => $line?->unit_cost,
                    'total' => $line?->total,
                    'lead_days' => $line?->lead_days ?? $quote->lead_days,
                    'note' => $line?->note,
                ];
            })->values();

            $costs = $cells->pluck('unit_cost')->filter(fn ($v) => $v !== null && $v > 0);
            $lowest = $costs->isEmpty() ? null : $costs->min();

            return [
                'rfq_item_id' => $item->id,
                'name' => $item->name_snapshot,
                'qty' => $item->qty,
                'unit' => $item->unit,
                'lowest_unit_cost' => $lowest,
                'cells' => $cells,
            ];
        })->values();

        return [
            'quotes' => $quotes->map(fn (VendorQuote $q) => [
                'id' => $q->id,
                'supplier_id' => $q->supplier_id,
                'supplier_name' => $q->supplier?->name,
                'status' => $q->status,
                'total' => $q->total,
                'lead_days' => $q->lead_days,
            ])->values(),
            'rows' => $rows,
        ];
    }

    public function loadRfq(Rfq $rfq): Rfq
    {
        return $rfq->load([
            'user:id,name',
            'outlet:id,name',
            'department:id,name,code',
            'warehouse:id,name',
            'items.product:id,name,sku',
            'suppliers.supplier:id,name',
            'quotes.supplier:id,name',
            'quotes.items',
            'winnerQuote.supplier:id,name',
            'requisitions:id,rfq_id,number,status',
        ]);
    }

    private function assertEditable(Rfq $rfq): void
    {
        if ($rfq->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['RFQ hanya bisa diubah saat draft.']]);
        }
    }

    private function assertSupplierInvited(Rfq $rfq, int $supplierId): void
    {
        $ok = $rfq->suppliers()->where('supplier_id', $supplierId)->exists();
        if (! $ok) {
            throw ValidationException::withMessages(['supplier_id' => ['Supplier tidak diundang di RFQ ini.']]);
        }
        $this->assertSupplier((int) $rfq->company_id, $supplierId);
    }

    /**
     * @param  list<array{product_id?: int, qty?: int, unit?: ?string, unit_level?: ?string, spec_note?: ?string, note?: ?string}>  $items
     */
    private function syncItems(Rfq $rfq, array $items): void
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item.']]);
        }

        $rfq->items()->delete();

        foreach ($items as $row) {
            $product = Product::query()->findOrFail($row['product_id']);
            $resolved = $this->productUnits->resolveLine(
                $product,
                isset($row['unit_level']) ? (string) $row['unit_level'] : null,
                isset($row['unit']) ? (string) $row['unit'] : null,
            );
            $rfq->items()->create([
                'company_id' => $rfq->company_id,
                'product_id' => $product->id,
                'qty' => (int) $row['qty'],
                'unit' => $resolved['unit'],
                'unit_level' => $resolved['level'],
                'factor_to_base' => $resolved['factor_to_base'],
                'name_snapshot' => $product->name,
                'spec_note' => $row['spec_note'] ?? null,
                'note' => $row['note'] ?? null,
            ]);
        }
    }

    /**
     * @param  list<int>  $supplierIds
     */
    private function syncSuppliers(Rfq $rfq, array $supplierIds): void
    {
        $ids = array_values(array_unique(array_map('intval', $supplierIds)));
        if ($ids === []) {
            return;
        }

        foreach ($ids as $supplierId) {
            $this->assertSupplier((int) $rfq->company_id, $supplierId);
        }

        $rfq->suppliers()->whereNotIn('supplier_id', $ids)->delete();

        foreach ($ids as $supplierId) {
            RfqSupplier::query()->firstOrCreate(
                [
                    'rfq_id' => $rfq->id,
                    'supplier_id' => $supplierId,
                ],
                [
                    'company_id' => $rfq->company_id,
                    'invited_at' => $rfq->status === 'open' ? now() : null,
                ],
            );
        }
    }

    /**
     * @param  list<array{rfq_item_id?: int, unit_cost?: int, qty?: int, lead_days?: ?int, note?: ?string}>  $items
     */
    private function syncQuoteItems(Rfq $rfq, VendorQuote $quote, array $items): void
    {
        if ($items === []) {
            return;
        }

        $rfqItemIds = $rfq->items()->pluck('id')->all();
        $quote->items()->delete();

        foreach ($items as $row) {
            $rfqItemId = (int) ($row['rfq_item_id'] ?? 0);
            if (! in_array($rfqItemId, $rfqItemIds, true)) {
                throw ValidationException::withMessages(['items' => ['Item quote tidak valid.']]);
            }

            $rfqItem = RfqItem::query()->findOrFail($rfqItemId);
            $qty = (int) ($row['qty'] ?? $rfqItem->qty);
            $unitCost = max(0, (int) ($row['unit_cost'] ?? 0));

            VendorQuoteItem::query()->create([
                'company_id' => $quote->company_id,
                'vendor_quote_id' => $quote->id,
                'rfq_item_id' => $rfqItemId,
                'unit_cost' => $unitCost,
                'qty' => $qty,
                'total' => $unitCost * $qty,
                'lead_days' => isset($row['lead_days']) ? (int) $row['lead_days'] : null,
                'note' => $row['note'] ?? null,
            ]);
        }
    }

    private function recalcQuoteTotals(VendorQuote $quote): void
    {
        $quote->load('items');
        $subtotal = $quote->items->sum('total');
        $quote->subtotal = $subtotal;
        $quote->tax = 0;
        $quote->total = $subtotal;
    }

    private function nextNumber(string $prefix, int $companyId): string
    {
        $full = $prefix.'-'.now()->format('ymd').'-';
        $last = Rfq::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('number', 'like', $full.'%')
            ->orderByDesc('number')
            ->lockForUpdate()
            ->value('number');

        $seq = $last ? ((int) substr((string) $last, -3)) + 1 : 1;

        return $full.str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
    }

    private function nextQuoteNumber(Rfq $rfq): string
    {
        $full = 'VQ-'.now()->format('ymd').'-';
        $last = VendorQuote::query()
            ->withoutGlobalScopes()
            ->where('company_id', $rfq->company_id)
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

    private function resolveOutletForWrite(array $payload, ?Rfq $rfq = null): Outlet
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        if (ProcurementSettings::costCenterEnabled($company) && ! empty($payload['outlet_id'])) {
            $outlet = Outlet::query()
                ->withoutGlobalScopes()
                ->where('company_id', $company->id)
                ->whereKey((int) $payload['outlet_id'])
                ->where('is_active', true)
                ->first();
            if ($outlet) {
                return $outlet;
            }

            throw ValidationException::withMessages(['outlet_id' => ['Outlet tidak valid.']]);
        }

        if ($rfq?->outlet_id) {
            $outlet = Outlet::query()->withoutGlobalScopes()->find($rfq->outlet_id);
            if ($outlet) {
                return $outlet;
            }
        }

        return Outlet::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('id')
            ->firstOrFail();
    }

    private function resolveDepartmentId(array $payload, User $user): ?int
    {
        if (! empty($payload['department_id'])) {
            return (int) $payload['department_id'];
        }

        return $user->department_id ? (int) $user->department_id : null;
    }
}
