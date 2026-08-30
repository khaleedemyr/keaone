<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\VendorPrepayment;
use App\Services\VendorPrepaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorPrepaymentController extends Controller
{
    public function __construct(private VendorPrepaymentService $prepayments) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorprepayments', 'view');

        $query = VendorPrepayment::query()
            ->with(['supplier:id,name', 'user:id,name', 'purchaseOrder:id,number'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($supplierId = $request->integer('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (VendorPrepayment $row) => $this->prepayments->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorprepayments', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'supplier_id' => ['required', 'integer'],
            'purchase_order_id' => ['nullable', 'integer'],
            'amount' => ['required', 'integer', 'min:1'],
            'payment_method' => ['nullable', 'string', 'in:cash,transfer,qris'],
            'note' => ['nullable', 'string'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
            'items' => ['sometimes', 'array'],
            'items.*.vendor_invoice_id' => ['required_with:items', 'integer'],
            'items.*.amount' => ['required_with:items', 'integer', 'min:1'],
        ]);

        $row = $this->prepayments->create($data, $request->user());

        return $this->ok($this->prepayments->serialize($row), [], 201);
    }

    public function show(VendorPrepayment $vendorPrepayment): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorprepayments', 'view');

        return $this->ok($this->prepayments->serialize($vendorPrepayment));
    }

    public function update(Request $request, VendorPrepayment $vendorPrepayment): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorprepayments', 'edit');

        $data = $request->validate([
            'supplier_id' => ['sometimes', 'integer'],
            'purchase_order_id' => ['nullable', 'integer'],
            'amount' => ['sometimes', 'integer', 'min:1'],
            'payment_method' => ['nullable', 'string', 'in:cash,transfer,qris'],
            'note' => ['nullable', 'string'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
            'items' => ['sometimes', 'array'],
            'items.*.vendor_invoice_id' => ['required_with:items', 'integer'],
            'items.*.amount' => ['required_with:items', 'integer', 'min:1'],
        ]);

        $row = $this->prepayments->update($vendorPrepayment, $data);

        return $this->ok($this->prepayments->serialize($row));
    }

    public function submit(VendorPrepayment $vendorPrepayment): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorprepayments', 'edit');

        return $this->ok($this->prepayments->serialize($this->prepayments->submit($vendorPrepayment)));
    }

    public function approve(VendorPrepayment $vendorPrepayment): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorprepayments', 'edit');

        return $this->ok($this->prepayments->serialize($this->prepayments->approve($vendorPrepayment, request()->user())));
    }

    public function reject(Request $request, VendorPrepayment $vendorPrepayment): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorprepayments', 'edit');

        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        return $this->ok($this->prepayments->serialize($this->prepayments->reject($vendorPrepayment, $request->user(), $data['note'] ?? null)));
    }

    public function pay(VendorPrepayment $vendorPrepayment): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorprepayments', 'edit');

        return $this->ok($this->prepayments->serialize($this->prepayments->pay($vendorPrepayment, request()->user())));
    }

    public function apply(Request $request, VendorPrepayment $vendorPrepayment): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorprepayments', 'edit');

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.vendor_invoice_id' => ['required', 'integer'],
            'items.*.amount' => ['required', 'integer', 'min:1'],
        ]);

        return $this->ok($this->prepayments->serialize($this->prepayments->apply($vendorPrepayment, $data['items'])));
    }

    public function cancel(VendorPrepayment $vendorPrepayment): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['vendorprepayments', 'edit'], ['vendorprepayments', 'delete']]);

        return $this->ok($this->prepayments->serialize($this->prepayments->cancel($vendorPrepayment)));
    }
}
