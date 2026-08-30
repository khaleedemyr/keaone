<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ProcurementReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProcurementReportController extends Controller
{
    public function __construct(private ProcurementReportService $reports) {}

    public function show(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('procurementreports', 'view');

        $data = $request->validate([
            'kind' => ['required', Rule::in([
                'spend',
                'cycle_time',
                'vendor_performance',
                'budget_actual',
                'open_po_aging',
                'price_variance',
                'abc',
            ])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'group_by' => ['nullable', Rule::in(['supplier', 'category', 'department', 'product'])],
            'budget_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $from = $data['from'] ?? now()->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->toDateString();

        return $this->ok($this->reports->report(
            $data['kind'],
            $from,
            $to,
            [
                'group_by' => $data['group_by'] ?? null,
                'budget_id' => $data['budget_id'] ?? null,
            ],
        ));
    }
}
