<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderDeliverySchedule;
use App\Models\PurchaseOrderItem;
use App\Support\ProcurementSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class PurchaseDeliveryScheduleService
{
    public function enabled(?\App\Models\Company $company = null): bool
    {
        return ProcurementSettings::bool('delivery_schedule_enabled', $company);
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(PurchaseOrderDeliverySchedule $row): array
    {
        $row->loadMissing([
            'order:id,number,status,supplier_id,expected_at',
            'order.supplier:id,name',
            'item:id,product_id,qty,qty_received,name_snapshot',
            'item.product:id,name,sku',
        ]);

        return [
            'id' => $row->id,
            'purchase_order_id' => $row->purchase_order_id,
            'purchase_order_item_id' => $row->purchase_order_item_id,
            'delivery_date' => $row->delivery_date?->toDateString(),
            'qty' => $row->qty,
            'status' => $row->status,
            'note' => $row->note,
            'fulfilled_at' => $row->fulfilled_at?->toIso8601String(),
            'is_overdue' => $row->status === 'planned'
                && $row->delivery_date?->toDateString() < now()->toDateString(),
            'order' => $row->order?->only(['id', 'number', 'status', 'expected_at']),
            'supplier' => $row->order?->supplier?->only(['id', 'name']),
            'item' => $row->item ? [
                'id' => $row->item->id,
                'product_id' => $row->item->product_id,
                'name_snapshot' => $row->item->name_snapshot,
                'qty' => $row->item->qty,
                'qty_received' => $row->item->qty_received,
                'product' => $row->item->product?->only(['id', 'name', 'sku']),
            ] : null,
            'created_at' => $row->created_at?->toIso8601String(),
        ];
    }

    public function listForOrder(PurchaseOrder $order): array
    {
        $this->assertEnabled();

        return PurchaseOrderDeliverySchedule::query()
            ->where('purchase_order_id', $order->id)
            ->orderBy('delivery_date')
            ->orderBy('id')
            ->get()
            ->map(fn (PurchaseOrderDeliverySchedule $row) => $this->serialize($row))
            ->values()
            ->all();
    }

    /**
     * @return array{items: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function paginate(array $filters, int $perPage = 20): array
    {
        $this->assertEnabled();

        $query = PurchaseOrderDeliverySchedule::query()
            ->with([
                'order:id,number,status,supplier_id,expected_at',
                'order.supplier:id,name',
                'item:id,product_id,qty,qty_received,name_snapshot',
                'item.product:id,name,sku',
            ])
            ->orderBy('delivery_date')
            ->orderBy('id');

        $this->applyFilters($query, $filters);

        $page = $query->paginate($perPage);

        return [
            'items' => $page->getCollection()
                ->map(fn (PurchaseOrderDeliverySchedule $row) => $this->serialize($row))
                ->values()
                ->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function create(PurchaseOrder $order, array $payload): PurchaseOrderDeliverySchedule
    {
        $this->assertEnabled();
        $this->assertOrderSchedulable($order);

        $itemId = $payload['purchase_order_item_id'] ?? null;
        $qty = isset($payload['qty']) ? (int) $payload['qty'] : null;

        if ($itemId) {
            $item = $this->resolveItem($order, (int) $itemId);
            $qty = max(1, $qty ?? 1);
            $this->assertItemQtyBudget($order, $item, $qty);
        } else {
            $qty = null;
        }

        $row = PurchaseOrderDeliverySchedule::query()->create([
            'company_id' => $order->company_id,
            'purchase_order_id' => $order->id,
            'purchase_order_item_id' => $itemId,
            'delivery_date' => $payload['delivery_date'],
            'qty' => $qty,
            'note' => $payload['note'] ?? null,
            'status' => 'planned',
        ]);

        return $row->fresh();
    }

    public function update(PurchaseOrder $order, PurchaseOrderDeliverySchedule $schedule, array $payload): PurchaseOrderDeliverySchedule
    {
        $this->assertEnabled();
        $this->assertBelongsToOrder($order, $schedule);

        if ($schedule->status !== 'planned') {
            throw ValidationException::withMessages([
                'status' => ['Jadwal hanya bisa diubah saat status planned.'],
            ]);
        }

        $itemId = array_key_exists('purchase_order_item_id', $payload)
            ? $payload['purchase_order_item_id']
            : $schedule->purchase_order_item_id;
        $qty = array_key_exists('qty', $payload) ? ($payload['qty'] !== null ? (int) $payload['qty'] : null) : $schedule->qty;

        if ($itemId) {
            $item = $this->resolveItem($order, (int) $itemId);
            $qty = max(1, $qty ?? 1);
            $this->assertItemQtyBudget($order, $item, $qty, $schedule->id);
        } else {
            $qty = null;
        }

        $schedule->update([
            'purchase_order_item_id' => $itemId,
            'delivery_date' => $payload['delivery_date'] ?? $schedule->delivery_date,
            'qty' => $qty,
            'note' => array_key_exists('note', $payload) ? $payload['note'] : $schedule->note,
        ]);

        return $schedule->fresh();
    }

    public function fulfill(PurchaseOrder $order, PurchaseOrderDeliverySchedule $schedule): PurchaseOrderDeliverySchedule
    {
        $this->assertEnabled();
        $this->assertBelongsToOrder($order, $schedule);

        if ($schedule->status !== 'planned') {
            throw ValidationException::withMessages([
                'status' => ['Hanya jadwal planned yang bisa ditandai fulfilled.'],
            ]);
        }

        $schedule->update([
            'status' => 'fulfilled',
            'fulfilled_at' => now(),
        ]);

        return $schedule->fresh();
    }

    public function cancel(PurchaseOrder $order, PurchaseOrderDeliverySchedule $schedule): PurchaseOrderDeliverySchedule
    {
        $this->assertEnabled();
        $this->assertBelongsToOrder($order, $schedule);

        if ($schedule->status !== 'planned') {
            throw ValidationException::withMessages([
                'status' => ['Hanya jadwal planned yang bisa dibatalkan.'],
            ]);
        }

        $schedule->update(['status' => 'cancelled']);

        return $schedule->fresh();
    }

    public function delete(PurchaseOrder $order, PurchaseOrderDeliverySchedule $schedule): void
    {
        $this->assertEnabled();
        $this->assertBelongsToOrder($order, $schedule);

        if ($schedule->status !== 'planned') {
            throw ValidationException::withMessages([
                'status' => ['Hanya jadwal planned yang bisa dihapus.'],
            ]);
        }

        $schedule->delete();
    }

    public function countPlannedOverdue(): int
    {
        if (! $this->enabled()) {
            return 0;
        }

        return PurchaseOrderDeliverySchedule::query()
            ->where('status', 'planned')
            ->whereDate('delivery_date', '<', now()->toDateString())
            ->count();
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        if ($status = ($filters['status'] ?? null)) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($poId = ($filters['purchase_order_id'] ?? null)) {
            $query->where('purchase_order_id', (int) $poId);
        }

        if ($from = ($filters['from'] ?? null)) {
            $query->whereDate('delivery_date', '>=', $from);
        }

        if ($to = ($filters['to'] ?? null)) {
            $query->whereDate('delivery_date', '<=', $to);
        }

        if (($filters['overdue'] ?? false)) {
            $query->where('status', 'planned')
                ->whereDate('delivery_date', '<', now()->toDateString());
        }

        if ($search = ($filters['search'] ?? null)) {
            $query->where(function (Builder $q) use ($search) {
                $q->whereHas('order', fn (Builder $o) => $o->where('number', 'like', "%{$search}%"))
                    ->orWhereHas('order.supplier', fn (Builder $s) => $s->where('name', 'like', "%{$search}%"));
            });
        }
    }

    private function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ValidationException::withMessages([
                'delivery_schedule' => ['Modul jadwal kirim tidak aktif. Aktifkan di Pengaturan Pengadaan.'],
            ]);
        }
    }

    private function assertOrderSchedulable(PurchaseOrder $order): void
    {
        if (! in_array($order->status, ['ordered', 'partial'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Jadwal kirim hanya untuk PO status ordered/partial.'],
            ]);
        }
    }

    private function assertBelongsToOrder(PurchaseOrder $order, PurchaseOrderDeliverySchedule $schedule): void
    {
        if ((int) $schedule->purchase_order_id !== (int) $order->id) {
            abort(404);
        }
    }

    private function resolveItem(PurchaseOrder $order, int $itemId): PurchaseOrderItem
    {
        $item = PurchaseOrderItem::query()
            ->where('purchase_order_id', $order->id)
            ->whereKey($itemId)
            ->first();

        if (! $item) {
            throw ValidationException::withMessages([
                'purchase_order_item_id' => ['Baris PO tidak valid.'],
            ]);
        }

        return $item;
    }

    private function assertItemQtyBudget(
        PurchaseOrder $order,
        PurchaseOrderItem $item,
        int $qty,
        ?int $ignoreScheduleId = null,
    ): void {
        $remaining = max(0, (int) $item->qty - (int) $item->qty_received);

        $planned = PurchaseOrderDeliverySchedule::query()
            ->where('purchase_order_id', $order->id)
            ->where('purchase_order_item_id', $item->id)
            ->where('status', 'planned')
            ->when($ignoreScheduleId, fn (Builder $q) => $q->where('id', '!=', $ignoreScheduleId))
            ->sum('qty');

        if ($planned + $qty > $remaining) {
            throw ValidationException::withMessages([
                'qty' => ["Total jadwal ({$planned} + {$qty}) melebihi sisa qty baris ({$remaining})."],
            ]);
        }
    }
}
