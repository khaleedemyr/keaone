<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Contact;
use App\Models\PurchaseOrder;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupplierController extends TypedContactController
{
    protected function menuKey(): string
    {
        return 'suppliers';
    }

    protected function contactType(): string
    {
        return 'supplier';
    }

    public function top(Request $request): JsonResponse
    {
        $this->ensureCanAny([
            [$this->menuKey(), 'view'],
            ['purchaseorders', 'view'],
            ['goodsreceipts', 'view'],
            ['purchaserequisitions', 'view'],
        ]);

        $limit = min(10, max(1, (int) $request->input('limit', 5)));
        $companyId = CurrentCompany::id();
        abort_unless($companyId, 422, 'Pilih perusahaan dulu.');

        $topIds = PurchaseOrder::query()
            ->where('company_id', $companyId)
            ->whereNotIn('status', ['cancelled', 'draft'])
            ->select('supplier_id', DB::raw('COUNT(*) as order_count'))
            ->groupBy('supplier_id')
            ->orderByDesc('order_count')
            ->limit($limit)
            ->pluck('supplier_id');

        if ($topIds->isEmpty()) {
            return $this->ok([]);
        }

        $type = $this->contactType();
        $contacts = Contact::query()
            ->whereIn('id', $topIds)
            ->where(function ($q) use ($type) {
                $q->where('type', $type)->orWhere('type', 'both');
            })
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        $items = $topIds
            ->map(fn ($id) => $contacts->get($id))
            ->filter()
            ->values();

        return $this->ok($items);
    }
}
