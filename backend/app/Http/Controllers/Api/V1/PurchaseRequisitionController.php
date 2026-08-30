<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseRequisition;
use App\Services\ProcurementFieldAuditService;
use App\Services\PurchaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseRequisitionController extends Controller
{
    public function __construct(private PurchaseService $purchases) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        if ($request->boolean('for_po')) {
            $this->ensureCanAny([['purchaseorders', 'create'], ['purchaseorders', 'view'], ['purchaserequisitions', 'view']]);
        } else {
            $this->ensureCan('purchaserequisitions', 'view');
        }

        $query = PurchaseRequisition::query()
            ->with(['user:id,name', 'outlet:id,name', 'department:id,name,code', 'warehouse:id,name', 'approvals.user:id,name', 'orders:id,purchase_requisition_id'])
            ->orderByDesc('id');

        if ($request->boolean('for_po')) {
            $query->where('status', 'approved')->whereDoesntHave('orders');
        } elseif ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($search = $request->string('search')->toString()) {
            $query->where('number', 'like', "%{$search}%");
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

        $page = $query->paginate($this->perPage($request, $request->boolean('for_po') ? 50 : 20));

        return $this->ok(
            $page->getCollection()->map(fn (PurchaseRequisition $pr) => $this->purchases->serializePr($pr))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'warehouse_id' => ['nullable', 'integer'],
            'outlet_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'needed_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $pr = $this->purchases->createRequisition($data, $request->user());

        return $this->ok($this->purchases->serializePr($pr), [], 201);
    }

    public function show(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'view');

        return $this->ok($this->purchases->serializePr($purchaseRequisition));
    }

    public function update(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'edit');

        $data = $request->validate([
            'warehouse_id' => ['nullable', 'integer'],
            'outlet_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'needed_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $pr = $this->purchases->updateRequisition($purchaseRequisition, $data);

        return $this->ok($this->purchases->serializePr($pr));
    }

    public function submit(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'edit');

        return $this->ok($this->purchases->serializePr($this->purchases->submitRequisition($purchaseRequisition)));
    }

    public function approve(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['purchaserequisitions', 'edit'], ['approvals', 'edit']]);

        $data = $request->validate([
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
        ]);

        return $this->ok($this->purchases->serializePr(
            $this->purchases->approveRequisition($purchaseRequisition, $request->user(), $data),
        ));
    }

    public function reject(Request $request, PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['purchaserequisitions', 'edit'], ['approvals', 'edit']]);

        return $this->ok($this->purchases->serializePr($this->purchases->rejectRequisition($purchaseRequisition, $request->user())));
    }

    public function cancel(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['purchaserequisitions', 'edit'], ['purchaserequisitions', 'delete']]);

        return $this->ok($this->purchases->serializePr($this->purchases->cancelRequisition($purchaseRequisition)));
    }

    public function share(PurchaseRequisition $purchaseRequisition): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'view');

        abort_if(! $this->purchases->canSharePr($purchaseRequisition), 422, 'PR belum bisa dibagikan.');

        $token = $this->purchases->ensurePrShareToken($purchaseRequisition);

        return $this->ok([
            'share_token' => $token,
        ]);
    }

    public function fieldAudits(PurchaseRequisition $purchaseRequisition, ProcurementFieldAuditService $audits): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('purchaserequisitions', 'view');

        return $this->ok($audits->listForDocument(
            (int) $purchaseRequisition->company_id,
            'pr',
            (int) $purchaseRequisition->id,
        ));
    }
}
