<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\VendorInvoice;
use App\Services\VendorInvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorInvoiceController extends Controller
{
    public function __construct(private VendorInvoiceService $invoices) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorinvoices', 'view');

        $query = VendorInvoice::query()
            ->with(['supplier:id,name', 'user:id,name'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($matchStatus = $request->string('match_status')->toString()) {
            if ($matchStatus !== 'all') {
                $query->where('match_status', $matchStatus);
            }
        }
        if ($supplierId = $request->integer('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($paymentStatus = $request->string('payment_status')->toString()) {
            $payableExpr = 'CASE WHEN amount_payable > 0 THEN amount_payable ELSE total END';
            if ($paymentStatus === 'unpaid') {
                $query->where('status', 'confirmed')->whereRaw("amount_paid < ({$payableExpr})");
            } elseif ($paymentStatus === 'partial') {
                $query->where('status', 'confirmed')
                    ->where('amount_paid', '>', 0)
                    ->whereRaw("amount_paid < ({$payableExpr})");
            } elseif ($paymentStatus === 'paid') {
                $query->where('status', 'confirmed')->whereRaw("amount_paid >= ({$payableExpr})");
            } elseif ($paymentStatus === 'payable') {
                $query->where('status', 'confirmed')->whereRaw("amount_paid < ({$payableExpr})");
            }
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('vendor_ref', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (VendorInvoice $row) => $this->invoices->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorinvoices', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'supplier_id' => ['required', 'integer'],
            'purchase_order_id' => ['nullable', 'integer'],
            'goods_receipt_id' => ['nullable', 'integer'],
            'vendor_ref' => ['nullable', 'string', 'max:100'],
            'invoice_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.discount' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'items.*.purchase_order_item_id' => ['nullable', 'integer'],
            'items.*.goods_receipt_item_id' => ['nullable', 'integer'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $row = $this->invoices->create($data, $request->user());

        return $this->ok($this->invoices->serialize($row), [], 201);
    }

    public function show(VendorInvoice $vendorInvoice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorinvoices', 'view');

        return $this->ok($this->invoices->serialize($vendorInvoice));
    }

    public function update(Request $request, VendorInvoice $vendorInvoice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorinvoices', 'edit');

        $data = $request->validate([
            'supplier_id' => ['sometimes', 'integer'],
            'purchase_order_id' => ['nullable', 'integer'],
            'goods_receipt_id' => ['nullable', 'integer'],
            'vendor_ref' => ['nullable', 'string', 'max:100'],
            'invoice_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.discount' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
            'items.*.purchase_order_item_id' => ['nullable', 'integer'],
            'items.*.goods_receipt_item_id' => ['nullable', 'integer'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $row = $this->invoices->update($vendorInvoice, $data);

        return $this->ok($this->invoices->serialize($row));
    }

    public function submit(VendorInvoice $vendorInvoice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorinvoices', 'edit');

        return $this->ok($this->invoices->serialize($this->invoices->submit($vendorInvoice)));
    }

    public function approve(VendorInvoice $vendorInvoice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorinvoices', 'edit');

        return $this->ok($this->invoices->serialize($this->invoices->approve($vendorInvoice, request()->user())));
    }

    public function reject(Request $request, VendorInvoice $vendorInvoice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorinvoices', 'edit');

        $data = $request->validate(['note' => ['nullable', 'string']]);

        return $this->ok($this->invoices->serialize(
            $this->invoices->reject($vendorInvoice, $request->user(), $data['note'] ?? null),
        ));
    }

    public function confirm(VendorInvoice $vendorInvoice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorinvoices', 'edit');

        return $this->ok($this->invoices->serialize($this->invoices->confirm($vendorInvoice)));
    }

    public function cancel(VendorInvoice $vendorInvoice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['vendorinvoices', 'edit'], ['vendorinvoices', 'delete']]);

        return $this->ok($this->invoices->serialize($this->invoices->cancel($vendorInvoice)));
    }

    public function match(VendorInvoice $vendorInvoice): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorinvoices', 'edit');

        return $this->ok($this->invoices->serialize($this->invoices->runMatch($vendorInvoice)));
    }
}
