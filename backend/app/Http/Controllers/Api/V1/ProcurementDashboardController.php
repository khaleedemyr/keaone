<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ProcurementDashboardService;
use Illuminate\Http\JsonResponse;

class ProcurementDashboardController extends Controller
{
    public function __construct(private ProcurementDashboardService $dashboard) {}

    public function show(): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('procurementdashboard', 'view');

        return $this->ok($this->dashboard->summary());
    }
}
