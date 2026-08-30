<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderDeliverySchedule;
use App\Services\PurchaseDeliveryScheduleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseDeliveryScheduleController extends Controller
{
    public function __construct(private PurchaseDeliveryScheduleService $schedules) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('deliveryschedules', 'view');

        $result = $this->schedules->paginate([
            'status' => $request->string('status')->toString() ?: 'all',
            'from' => $request->string('from')->toString() ?: null,
            'to' => $request->string('to')->toString() ?: null,
            'overdue' => $request->boolean('overdue'),
            'search' => $request->string('search')->toString() ?: null,
            'purchase_order_id' => $request->integer('purchase_order_id') ?: null,
        ], $this->perPage($request, 20));

        return $this->ok($result['items'], $result['meta']);
    }

    public function forOrder(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['deliveryschedules', 'view'], ['purchaseorders', 'view']]);

        return $this->ok($this->schedules->listForOrder($purchaseOrder));
    }

    public function store(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['deliveryschedules', 'create'], ['purchaseorders', 'edit']]);

        $data = $request->validate([
            'purchase_order_item_id' => ['nullable', 'integer'],
            'delivery_date' => ['required', 'date'],
            'qty' => ['nullable', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $row = $this->schedules->create($purchaseOrder, $data);

        return $this->ok($this->schedules->serialize($row), [], 201);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderDeliverySchedule $deliverySchedule): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['deliveryschedules', 'edit'], ['purchaseorders', 'edit']]);

        $data = $request->validate([
            'purchase_order_item_id' => ['nullable', 'integer'],
            'delivery_date' => ['sometimes', 'date'],
            'qty' => ['nullable', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $row = $this->schedules->update($purchaseOrder, $deliverySchedule, $data);

        return $this->ok($this->schedules->serialize($row));
    }

    public function fulfill(PurchaseOrder $purchaseOrder, PurchaseOrderDeliverySchedule $deliverySchedule): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['deliveryschedules', 'edit'], ['purchaseorders', 'edit']]);

        return $this->ok($this->schedules->serialize($this->schedules->fulfill($purchaseOrder, $deliverySchedule)));
    }

    public function cancel(PurchaseOrder $purchaseOrder, PurchaseOrderDeliverySchedule $deliverySchedule): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['deliveryschedules', 'edit'], ['purchaseorders', 'edit']]);

        return $this->ok($this->schedules->serialize($this->schedules->cancel($purchaseOrder, $deliverySchedule)));
    }

    public function destroy(PurchaseOrder $purchaseOrder, PurchaseOrderDeliverySchedule $deliverySchedule): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCanAny([['deliveryschedules', 'delete'], ['purchaseorders', 'edit']]);

        $this->schedules->delete($purchaseOrder, $deliverySchedule);

        return $this->ok(['deleted' => true]);
    }
}
