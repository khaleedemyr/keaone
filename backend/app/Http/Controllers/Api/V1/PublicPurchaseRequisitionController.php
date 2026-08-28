<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseRequisition;
use App\Services\PurchaseService;
use Illuminate\Http\JsonResponse;

class PublicPurchaseRequisitionController extends Controller
{
    public function __construct(private PurchaseService $purchases) {}

    public function show(string $shareToken): JsonResponse
    {
        $pr = PurchaseRequisition::query()
            ->where('share_token', $shareToken)
            ->firstOrFail();

        abort_unless($this->purchases->canSharePr($pr), 404);

        return $this->ok($this->purchases->serializePrPublic($pr));
    }
}
