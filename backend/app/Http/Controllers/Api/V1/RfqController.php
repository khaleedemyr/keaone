<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Rfq;
use App\Models\VendorQuote;
use App\Services\PurchaseService;
use App\Services\RfqService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RfqController extends Controller
{
    public function __construct(
        private RfqService $rfqs,
        private PurchaseService $purchases,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'view');
        $this->rfqs->assertEnabled();

        $query = Rfq::query()
            ->with(['user:id,name', 'outlet:id,name', 'department:id,name,code'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%");
            });
        }

        if ($from = $request->string('from')->toString()) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->string('to')->toString()) {
            $query->whereDate('created_at', '<=', $to);
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (Rfq $row) => $this->rfqs->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'title' => ['required', 'string', 'max:200'],
            'warehouse_id' => ['nullable', 'integer'],
            'outlet_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'due_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.spec_note' => ['nullable', 'string'],
            'items.*.note' => ['nullable', 'string'],
            'supplier_ids' => ['sometimes', 'array'],
            'supplier_ids.*' => ['integer'],
        ]);

        $rfq = $this->rfqs->create($data, $request->user());

        return $this->ok($this->rfqs->serialize($rfq), [], 201);
    }

    public function show(Rfq $rfq): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'view');
        $this->rfqs->assertEnabled();

        return $this->ok($this->rfqs->serialize($rfq, true));
    }

    public function update(Request $request, Rfq $rfq): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'edit');
        $this->rfqs->assertEnabled();

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'warehouse_id' => ['nullable', 'integer'],
            'outlet_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'due_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.spec_note' => ['nullable', 'string'],
            'items.*.note' => ['nullable', 'string'],
            'supplier_ids' => ['sometimes', 'array'],
            'supplier_ids.*' => ['integer'],
        ]);

        $rfq = $this->rfqs->update($rfq, $data);

        return $this->ok($this->rfqs->serialize($rfq, true));
    }

    public function destroy(Rfq $rfq): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'delete');
        $this->rfqs->assertEnabled();

        $this->rfqs->delete($rfq);

        return $this->ok(['deleted' => true]);
    }

    public function send(Rfq $rfq): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'edit');
        $this->rfqs->assertEnabled();

        return $this->ok($this->rfqs->serialize($this->rfqs->send($rfq), true));
    }

    public function close(Rfq $rfq): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'edit');
        $this->rfqs->assertEnabled();

        return $this->ok($this->rfqs->serialize($this->rfqs->close($rfq), true));
    }

    public function cancel(Rfq $rfq): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'edit');
        $this->rfqs->assertEnabled();

        return $this->ok($this->rfqs->serialize($this->rfqs->cancel($rfq), true));
    }

    public function compare(Rfq $rfq): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'view');
        $this->rfqs->assertEnabled();

        return $this->ok($this->rfqs->buildComparison($rfq));
    }

    public function upsertQuote(Request $request, Rfq $rfq, int $supplierId): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'edit');
        $this->rfqs->assertEnabled();

        $data = $request->validate([
            'client_uuid' => ['sometimes', 'uuid'],
            'note' => ['nullable', 'string'],
            'lead_days' => ['nullable', 'integer', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.rfq_item_id' => ['required', 'integer'],
            'items.*.unit_cost' => ['required', 'integer', 'min:0'],
            'items.*.qty' => ['nullable', 'integer', 'min:1'],
            'items.*.lead_days' => ['nullable', 'integer', 'min:0'],
            'items.*.note' => ['nullable', 'string'],
        ]);

        $quote = $this->rfqs->upsertQuote($rfq, $supplierId, $data);

        return $this->ok($this->rfqs->serializeQuote($quote));
    }

    public function submitQuote(Rfq $rfq, VendorQuote $vendorQuote): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'edit');
        $this->rfqs->assertEnabled();

        abort_if((int) $vendorQuote->rfq_id !== (int) $rfq->id, 404);

        $quote = $this->rfqs->submitQuote($vendorQuote);

        return $this->ok($this->rfqs->serializeQuote($quote));
    }

    public function selectWinner(Request $request, Rfq $rfq): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'edit');
        $this->rfqs->assertEnabled();

        $data = $request->validate([
            'vendor_quote_id' => ['required', 'integer'],
        ]);

        $rfq = $this->rfqs->selectWinner($rfq, (int) $data['vendor_quote_id']);

        return $this->ok($this->rfqs->serialize($rfq, true));
    }

    public function createPr(Request $request, Rfq $rfq): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('rfqs', 'edit');
        $this->ensureCan('purchaserequisitions', 'create');
        $this->rfqs->assertEnabled();
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'needed_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'approvals' => ['sometimes', 'array'],
            'approvals.*.user_id' => ['required_with:approvals', 'integer'],
        ]);

        $pr = $this->rfqs->createPrFromRfq($rfq, $request->user(), $data);

        return $this->ok($this->purchases->serializePr($pr), [], 201);
    }
}
