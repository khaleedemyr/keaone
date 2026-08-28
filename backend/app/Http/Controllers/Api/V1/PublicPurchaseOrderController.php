<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Services\PurchaseService;
use Illuminate\Http\JsonResponse;

class PublicPurchaseOrderController extends Controller
{
    public function __construct(private PurchaseService $purchases) {}

    public function show(string $shareToken): JsonResponse
    {
        $po = PurchaseOrder::query()
            ->where('share_token', $shareToken)
            ->firstOrFail();

        abort_unless($this->purchases->canSharePo($po), 404);

        return $this->ok($this->purchases->serializePoPublic($po));
    }
}
