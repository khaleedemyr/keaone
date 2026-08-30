<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MatchException;
use App\Services\ProcurementMatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MatchExceptionController extends Controller
{
    public function __construct(private ProcurementMatchService $matchService) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('matchexceptions', 'view');

        $query = MatchException::query()
            ->with(['vendorInvoice:id,number,status', 'vendorInvoiceItem:id,name_snapshot'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }
        if ($invoiceId = $request->integer('vendor_invoice_id')) {
            $query->where('vendor_invoice_id', $invoiceId);
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (MatchException $row) => $this->matchService->serializeException($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function waive(Request $request, MatchException $matchException): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('matchexceptions', 'edit');

        $data = $request->validate(['note' => ['nullable', 'string']]);

        $row = $this->matchService->waive($matchException, $request->user(), $data['note'] ?? null);

        return $this->ok($this->matchService->serializeException($row));
    }
}
