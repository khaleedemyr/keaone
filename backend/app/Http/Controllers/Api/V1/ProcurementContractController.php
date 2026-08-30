<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ProcurementContract;
use App\Services\ProcurementContractService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProcurementContractController extends Controller
{
    public function __construct(private ProcurementContractService $contracts) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('procurementcontracts', 'view');
        $this->contracts->assertEnabled();

        $query = ProcurementContract::query()
            ->with(['supplier:id,name', 'user:id,name'])
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

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (ProcurementContract $row) => $this->contracts->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('procurementcontracts', 'create');
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'title' => ['required', 'string', 'max:200'],
            'supplier_id' => ['required', 'integer'],
            'warehouse_id' => ['nullable', 'integer'],
            'outlet_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date', 'after_or_equal:period_start'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
        ]);

        $contract = $this->contracts->create($data, $request->user());

        return $this->ok($this->contracts->serialize($contract), [], 201);
    }

    public function show(ProcurementContract $procurementContract): JsonResponse
    {
        $this->ensureCan('procurementcontracts', 'view');
        $this->contracts->assertEnabled();

        return $this->ok($this->contracts->serialize($procurementContract));
    }

    public function update(Request $request, ProcurementContract $procurementContract): JsonResponse
    {
        $this->ensureCan('procurementcontracts', 'edit');
        $this->contracts->assertEnabled();

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'supplier_id' => ['sometimes', 'integer'],
            'warehouse_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'integer', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.unit_level' => ['nullable', 'string', 'in:small,medium,large'],
            'items.*.note' => ['nullable', 'string'],
        ]);

        $contract = $this->contracts->update($procurementContract, $data);

        return $this->ok($this->contracts->serialize($contract));
    }

    public function destroy(ProcurementContract $procurementContract): JsonResponse
    {
        $this->ensureCan('procurementcontracts', 'delete');
        $this->contracts->assertEnabled();

        if ($procurementContract->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya kontrak draft yang bisa dihapus.']]);
        }

        $procurementContract->delete();

        return $this->ok(null);
    }

    public function activate(ProcurementContract $procurementContract): JsonResponse
    {
        $this->ensureCan('procurementcontracts', 'edit');

        return $this->ok($this->contracts->serialize($this->contracts->activate($procurementContract)));
    }

    public function close(ProcurementContract $procurementContract): JsonResponse
    {
        $this->ensureCan('procurementcontracts', 'edit');

        return $this->ok($this->contracts->serialize($this->contracts->close($procurementContract)));
    }

    public function cancel(ProcurementContract $procurementContract): JsonResponse
    {
        $this->ensureCan('procurementcontracts', 'edit');

        return $this->ok($this->contracts->serialize($this->contracts->cancel($procurementContract)));
    }

    public function releasePo(Request $request, ProcurementContract $procurementContract): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('procurementcontracts', 'create');
        $this->ensureCan('purchaseorders', 'create');

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'expected_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.contract_item_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.note' => ['nullable', 'string'],
        ]);

        $po = $this->contracts->releasePo($procurementContract, $request->user(), $data);

        return $this->ok([
            'purchase_order_id' => $po->id,
            'number' => $po->number,
        ], [], 201);
    }
}
