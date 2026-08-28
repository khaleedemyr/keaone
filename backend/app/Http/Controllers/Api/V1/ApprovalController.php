<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderApproval;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseRequisitionApproval;
use App\Services\PurchaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalController extends Controller
{
    public function __construct(private PurchaseService $purchases) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('approvals', 'view');

        $userId = (int) $request->user()->id;

        $pendingPr = PurchaseRequisitionApproval::query()
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->with(['requisition.user:id,name', 'requisition.warehouse:id,name', 'requisition.approvals.user:id,name'])
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->filter(function (PurchaseRequisitionApproval $row) {
                $pr = $row->requisition;
                if (! $pr || $pr->status !== 'submitted') {
                    return false;
                }

                return (int) $pr->current_approval_level === (int) $row->level;
            })
            ->values();

        $prItems = $pendingPr->map(function (PurchaseRequisitionApproval $row) {
            /** @var PurchaseRequisition $pr */
            $pr = $row->requisition;

            return [
                'type' => 'purchase_requisition',
                'id' => $pr->id,
                'title' => $pr->number,
                'subtitle' => $pr->user?->name,
                'level' => (int) $row->level,
                'status' => $pr->status,
                'created_at' => $pr->created_at?->toIso8601String(),
                'can_approve' => true,
                'payload' => $this->purchases->serializePr($pr),
            ];
        });

        $pendingPo = PurchaseOrderApproval::query()
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->with(['order.user:id,name', 'order.warehouse:id,name', 'order.supplier:id,name', 'order.approvals.user:id,name'])
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->filter(function (PurchaseOrderApproval $row) {
                $po = $row->order;
                if (! $po || $po->status !== 'submitted') {
                    return false;
                }

                return (int) $po->current_approval_level === (int) $row->level;
            })
            ->values();

        $poItems = $pendingPo->map(function (PurchaseOrderApproval $row) {
            /** @var PurchaseOrder $po */
            $po = $row->order;

            return [
                'type' => 'purchase_order',
                'id' => $po->id,
                'title' => $po->number,
                'subtitle' => $po->user?->name,
                'level' => (int) $row->level,
                'status' => $po->status,
                'created_at' => $po->created_at?->toIso8601String(),
                'can_approve' => true,
                'payload' => $this->purchases->serializePo($po),
            ];
        });

        $items = $prItems->concat($poItems)
            ->sortByDesc(fn (array $row) => $row['created_at'] ?? '')
            ->values();

        return $this->ok($items);
    }
}
