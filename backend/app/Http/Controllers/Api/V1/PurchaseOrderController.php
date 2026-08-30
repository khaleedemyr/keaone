<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Services\ProcurementFieldAuditService;
use App\Services\PurchaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseOrderController extends Controller
{
    public function __construct(private PurchaseService $purchases) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaseorders', 'view');

        $query = PurchaseOrder::query()
            ->with(['supplier:id,name', 'warehouse:id,name', 'outlet:id,name', 'department:id,name,code', 'user:id,name', 'approvals.user:id,name'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }

        if ($from = $request->string('from')->toString()) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->string('to')->toString()) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($departmentId = $request->integer('department_id')) {
            $query->where('department_id', $departmentId);
        }
        if ($outletId = $request->integer('outlet_id')) {
            $query->where('outlet_id', $outletId);
        }
        if ($supplierId = $request->integer('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (PurchaseOrder $po) => $this->purchases->serializePo($po))->values(),
            $this->pageMeta($page),
        );
    }

    public function lookup(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('goodsreceipts', 'create');

        $id = $request->integer('id');
        $number = trim($request->string('number')->toString());

        abort_if(! $id && $number === '', 422, 'Nomor PO wajib diisi.');

        $query = PurchaseOrder::query();
        if ($id) {
            $query->whereKey($id);
        } else {
            $query->where(function ($q) use ($number) {
                $q->where('number', $number)
                    ->orWhereRaw('LOWER(number) = ?', [strtolower($number)]);
            });
        }

        $po = $query->first();
        abort_if(! $po, 404, 'PO tidak ditemukan.');
        abort_if(
            ! in_array($po->status, ['ordered', 'partial'], true),
            422,
            'PO belum bisa diterima (status: '.$po->status.').',
        );

        return $this->ok($this->purchases->serializePo($po));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaseorders', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'supplier_id' => ['required', 'integer'],
            'purchase_requisition_id' => ['nullable', 'integer'],
            'warehouse_id' => ['nullable', 'integer'],
            'outlet_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'expected_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.discount' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'items.*.purchase_requisition_item_id' => ['nullable', 'integer'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $po = $this->purchases->createOrder($data, $request->user());

        return $this->ok($this->purchases->serializePo($po), [], 201);
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaseorders', 'view');

        return $this->ok($this->purchases->serializePo($purchaseOrder));
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaseorders', 'edit');

        $data = $request->validate([
            'supplier_id' => ['sometimes', 'integer'],
            'warehouse_id' => ['nullable', 'integer'],
            'outlet_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'expected_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.discount' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'items.*.purchase_requisition_item_id' => ['nullable', 'integer'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $po = $this->purchases->updateOrder($purchaseOrder, $data);

        return $this->ok($this->purchases->serializePo($po));
    }

    public function submit(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaseorders', 'edit');

        return $this->ok($this->purchases->serializePo($this->purchases->submitOrder($purchaseOrder)));
    }

    public function approve(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['purchaseorders', 'edit'], ['approvals', 'edit']]);

        $data = $request->validate([
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
        ]);

        return $this->ok($this->purchases->serializePo(
            $this->purchases->approveOrder($purchaseOrder, $request->user(), $data),
        ));
    }

    public function reject(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['purchaseorders', 'edit'], ['approvals', 'edit']]);

        return $this->ok($this->purchases->serializePo(
            $this->purchases->rejectOrder($purchaseOrder, $request->user()),
        ));
    }

    public function markOrdered(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaseorders', 'edit');

        return $this->ok($this->purchases->serializePo($this->purchases->orderPurchaseOrder($purchaseOrder)));
    }

    public function close(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaseorders', 'edit');

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        return $this->ok($this->purchases->serializePo(
            $this->purchases->closeOrder($purchaseOrder, $request->user(), $data['reason'] ?? null),
        ));
    }

    public function cancel(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['purchaseorders', 'edit'], ['purchaseorders', 'delete']]);

        return $this->ok($this->purchases->serializePo($this->purchases->cancelOrder($purchaseOrder)));
    }

    public function share(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaseorders', 'view');

        abort_if(! $this->purchases->canSharePo($purchaseOrder), 422, 'PO belum bisa dibagikan.');

        $token = $this->purchases->ensureShareToken($purchaseOrder);

        return $this->ok([
            'share_token' => $token,
        ]);
    }

    public function fieldAudits(PurchaseOrder $purchaseOrder, ProcurementFieldAuditService $audits): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaseorders', 'view');

        return $this->ok($audits->listForDocument(
            (int) $purchaseOrder->company_id,
            'po',
            (int) $purchaseOrder->id,
        ));
    }
}
