<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\VendorPaymentBatch;
use App\Services\VendorPaymentBatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorPaymentBatchController extends Controller
{
    public function __construct(private VendorPaymentBatchService $batches) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorpaymentbatches', 'view');

        $query = VendorPaymentBatch::query()
            ->with(['user:id,name'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($search = $request->string('search')->toString()) {
            $query->where('number', 'like', "%{$search}%");
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (VendorPaymentBatch $row) => $this->batches->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorpaymentbatches', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'payment_method' => ['nullable', 'string', 'in:cash,transfer,qris'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.vendor_invoice_id' => ['required', 'integer'],
            'items.*.amount' => ['nullable', 'integer', 'min:1'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $row = $this->batches->create($data, $request->user());

        return $this->ok($this->batches->serialize($row), [], 201);
    }

    public function show(VendorPaymentBatch $vendorPaymentBatch): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorpaymentbatches', 'view');

        return $this->ok($this->batches->serialize($vendorPaymentBatch));
    }

    public function update(Request $request, VendorPaymentBatch $vendorPaymentBatch): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorpaymentbatches', 'edit');

        $data = $request->validate([
            'payment_method' => ['nullable', 'string', 'in:cash,transfer,qris'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.vendor_invoice_id' => ['required_with:items', 'integer'],
            'items.*.amount' => ['nullable', 'integer', 'min:1'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $row = $this->batches->update($vendorPaymentBatch, $data);

        return $this->ok($this->batches->serialize($row));
    }

    public function submit(VendorPaymentBatch $vendorPaymentBatch): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorpaymentbatches', 'edit');

        return $this->ok($this->batches->serialize($this->batches->submit($vendorPaymentBatch)));
    }

    public function approve(VendorPaymentBatch $vendorPaymentBatch): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorpaymentbatches', 'edit');

        return $this->ok($this->batches->serialize($this->batches->approve($vendorPaymentBatch, request()->user())));
    }

    public function reject(Request $request, VendorPaymentBatch $vendorPaymentBatch): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorpaymentbatches', 'edit');

        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        return $this->ok($this->batches->serialize($this->batches->reject($vendorPaymentBatch, $request->user(), $data['note'] ?? null)));
    }

    public function pay(VendorPaymentBatch $vendorPaymentBatch): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorpaymentbatches', 'edit');

        return $this->ok($this->batches->serialize($this->batches->pay($vendorPaymentBatch, request()->user())));
    }

    public function cancel(VendorPaymentBatch $vendorPaymentBatch): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['vendorpaymentbatches', 'edit'], ['vendorpaymentbatches', 'delete']]);

        return $this->ok($this->batches->serialize($this->batches->cancel($vendorPaymentBatch)));
    }
}
