<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\GoodsReceipt;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Models\VendorAdjustmentNote;
use App\Models\VendorAdjustmentNoteItem;
use App\Support\CurrentCompany;
use App\Support\ProcurementSettings;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VendorAdjustmentService
{
    public function enabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::bool('vendor_adjustment_enabled', $company);
    }

    public function create(array $payload, User $user): VendorAdjustmentNote
    {
        $this->assertEnabled();

        $existing = VendorAdjustmentNote::query()->where('client_uuid', $payload['client_uuid'])->first();
        if ($existing) {
            return $this->loadNote($existing);
        }

        try {
            return DB::transaction(fn () => $this->writeNote($payload, $user));
        } catch (UniqueConstraintViolationException) {
            $row = VendorAdjustmentNote::query()->where('client_uuid', $payload['client_uuid'])->firstOrFail();

            return $this->loadNote($row);
        }
    }

    public function update(VendorAdjustmentNote $note, array $payload): VendorAdjustmentNote
    {
        if ($note->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Nota hanya bisa diubah saat draft.']]);
        }

        return DB::transaction(function () use ($note, $payload) {
            $note->update([
                'type' => $payload['type'] ?? $note->type,
                'supplier_id' => $payload['supplier_id'] ?? $note->supplier_id,
                'goods_receipt_id' => array_key_exists('goods_receipt_id', $payload)
                    ? $payload['goods_receipt_id']
                    : $note->goods_receipt_id,
                'purchase_order_id' => array_key_exists('purchase_order_id', $payload)
                    ? $payload['purchase_order_id']
                    : $note->purchase_order_id,
                'reason' => $payload['reason'] ?? $note->reason,
                'note' => $payload['note'] ?? $note->note,
            ]);

            if (isset($payload['items'])) {
                $note->items()->delete();
                $total = $this->attachItems($note, $payload['items']);
                $note->update(['total' => $total]);
            }

            return $this->loadNote($note->fresh());
        });
    }

    public function confirm(VendorAdjustmentNote $note): VendorAdjustmentNote
    {
        if ($note->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dikonfirmasi.']]);
        }
        if ($note->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => ['Nota belum punya item.']]);
        }

        $note->update([
            'status' => 'confirmed',
            'confirmed_at' => now(),
        ]);

        return $this->loadNote($note->fresh());
    }

    public function cancel(VendorAdjustmentNote $note): VendorAdjustmentNote
    {
        if ($note->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya draft yang bisa dibatalkan.']]);
        }

        $note->update(['status' => 'cancelled']);

        return $this->loadNote($note->fresh());
    }

    public function serialize(VendorAdjustmentNote $note): array
    {
        $note = $this->loadNote($note);

        return [
            'id' => $note->id,
            'type' => $note->type,
            'number' => $note->number,
            'client_uuid' => $note->client_uuid,
            'status' => $note->status,
            'reason' => $note->reason,
            'note' => $note->note,
            'total' => $note->total,
            'confirmed_at' => $note->confirmed_at?->toIso8601String(),
            'supplier_id' => $note->supplier_id,
            'supplier' => $note->supplier?->only(['id', 'name']),
            'goods_receipt_id' => $note->goods_receipt_id,
            'goods_receipt' => $note->goodsReceipt?->only(['id', 'number', 'status']),
            'purchase_order_id' => $note->purchase_order_id,
            'purchase_order' => $note->purchaseOrder?->only(['id', 'number', 'status']),
            'user' => $note->user?->only(['id', 'name']),
            'created_at' => $note->created_at?->toIso8601String(),
            'items' => $note->items->map(fn (VendorAdjustmentNoteItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'name_snapshot' => $item->name_snapshot,
                'qty' => $item->qty,
                'unit_cost_before' => $item->unit_cost_before,
                'unit_cost_after' => $item->unit_cost_after,
                'adjustment_amount' => $item->adjustment_amount,
                'note' => $item->note,
            ])->values(),
        ];
    }

    private function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'adjustment' => ['Modul debit/credit note tidak aktif. Aktifkan di Pengaturan Pengadaan.'],
            ]);
        }
    }

    private function writeNote(array $payload, User $user): VendorAdjustmentNote
    {
        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        $type = (string) ($payload['type'] ?? 'credit');
        if (! in_array($type, ['debit', 'credit'], true)) {
            throw ValidationException::withMessages(['type' => ['Tipe nota harus debit atau credit.']]);
        }

        $supplierId = (int) ($payload['supplier_id'] ?? 0);
        $this->assertSupplier($company->id, $supplierId);

        $grId = $payload['goods_receipt_id'] ?? null;
        $poId = $payload['purchase_order_id'] ?? null;
        if ($grId) {
            $gr = GoodsReceipt::query()->findOrFail($grId);
            if ((int) $gr->supplier_id !== $supplierId) {
                throw ValidationException::withMessages(['goods_receipt_id' => ['Supplier GR tidak cocok.']]);
            }
            if ($gr->status !== 'confirmed') {
                throw ValidationException::withMessages(['goods_receipt_id' => ['GR harus sudah dikonfirmasi.']]);
            }
            $poId = $poId ?? $gr->purchase_order_id;
        }

        $outletId = (int) (Outlet::query()
            ->where('company_id', $company->id)
            ->orderByDesc('is_default')
            ->value('id') ?? 0);

        $note = VendorAdjustmentNote::query()->create([
            'company_id' => $company->id,
            'outlet_id' => $outletId,
            'user_id' => $user->id,
            'supplier_id' => $supplierId,
            'goods_receipt_id' => $grId,
            'purchase_order_id' => $poId,
            'type' => $type,
            'number' => $this->nextNumber($type, $company->id),
            'client_uuid' => $payload['client_uuid'],
            'status' => 'draft',
            'reason' => $payload['reason'] ?? null,
            'note' => $payload['note'] ?? null,
            'total' => 0,
        ]);

        $total = $this->attachItems($note, $payload['items'] ?? []);
        $note->update(['total' => $total]);

        return $this->loadNote($note->fresh());
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function attachItems(VendorAdjustmentNote $note, array $items): int
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => ['Minimal 1 item.']]);
        }

        $total = 0;
        foreach ($items as $row) {
            $product = Product::query()->findOrFail($row['product_id']);
            $qty = max(1, (int) ($row['qty'] ?? 1));
            $before = max(0, (int) ($row['unit_cost_before'] ?? $product->cost_price ?? 0));
            $after = max(0, (int) ($row['unit_cost_after'] ?? $before));
            $amount = (int) ($row['adjustment_amount'] ?? (abs($after - $before) * $qty));

            if ($amount < 1) {
                throw ValidationException::withMessages([
                    'items' => ["Nilai koreksi untuk {$product->name} harus lebih dari 0."],
                ]);
            }

            if ($note->type === 'credit' && $after > $before) {
                throw ValidationException::withMessages([
                    'items' => ["Credit note: harga setelah ({$after}) tidak boleh lebih besar dari sebelum ({$before}) untuk {$product->name}."],
                ]);
            }
            if ($note->type === 'debit' && $after < $before) {
                throw ValidationException::withMessages([
                    'items' => ["Debit note: harga setelah ({$after}) tidak boleh lebih kecil dari sebelum ({$before}) untuk {$product->name}."],
                ]);
            }

            $note->items()->create([
                'company_id' => $note->company_id,
                'product_id' => $product->id,
                'goods_receipt_item_id' => $row['goods_receipt_item_id'] ?? null,
                'qty' => $qty,
                'unit_cost_before' => $before,
                'unit_cost_after' => $after,
                'adjustment_amount' => $amount,
                'name_snapshot' => $product->name,
                'note' => $row['note'] ?? null,
            ]);

            $total += $amount;
        }

        return $total;
    }

    private function nextNumber(string $type, int $companyId): string
    {
        $prefix = $type === 'debit' ? 'VDN' : 'VCN';
        $full = $prefix.'-'.now()->format('ymd').'-';
        $last = VendorAdjustmentNote::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('number', 'like', $full.'%')
            ->orderByDesc('number')
            ->lockForUpdate()
            ->value('number');

        $seq = $last ? ((int) substr((string) $last, -3)) + 1 : 1;

        return $full.str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
    }

    private function assertSupplier(int $companyId, int $supplierId): void
    {
        $ok = Contact::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($supplierId)
            ->whereIn('type', ['supplier', 'both'])
            ->where('is_active', true)
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages(['supplier_id' => ['Supplier tidak valid.']]);
        }
    }

    private function loadNote(VendorAdjustmentNote $note): VendorAdjustmentNote
    {
        return $note->load([
            'supplier:id,name',
            'goodsReceipt:id,number,status',
            'purchaseOrder:id,number,status',
            'user:id,name',
            'items',
        ]);
    }
}
