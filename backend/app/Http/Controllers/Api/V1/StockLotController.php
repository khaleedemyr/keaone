<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StockLot;
use App\Services\LotLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockLotController extends Controller
{
    public function __construct(private LotLedgerService $lots) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockproduction', 'view');

        $query = StockLot::query()
            ->with(['warehouse:id,name', 'product:id,name,sku'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($warehouseId = $request->integer('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }
        if ($productId = $request->integer('product_id')) {
            $query->where('product_id', $productId);
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('lot_code', 'like', "%{$search}%");
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (StockLot $row) => $this->lots->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function show(StockLot $stockLot): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stockproduction', 'view');

        return $this->ok($this->lots->serialize($stockLot->load('movements')));
    }
}
