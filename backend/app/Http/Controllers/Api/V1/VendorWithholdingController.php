<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\VendorWithholdingRecord;
use App\Services\WithholdingTaxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorWithholdingController extends Controller
{
    public function __construct(private WithholdingTaxService $withholding) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorwithholding', 'view');

        if (! $this->withholding->enabled()) {
            return $this->ok([], ['total' => 0, 'last_page' => 1, 'current_page' => 1]);
        }

        $query = VendorWithholdingRecord::query()
            ->with(['supplier:id,name'])
            ->orderByDesc('withheld_at')
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($type = $request->string('type')->toString()) {
            if ($type !== 'all') {
                $query->where('withholding_tax_type', $type);
            }
        }
        if ($supplierId = $request->integer('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (VendorWithholdingRecord $row) => $this->withholding->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function remit(VendorWithholdingRecord $vendorWithholdingRecord): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('vendorwithholding', 'edit');

        $record = $this->withholding->markRemitted($vendorWithholdingRecord);

        return $this->ok($this->withholding->serialize($record));
    }
}
