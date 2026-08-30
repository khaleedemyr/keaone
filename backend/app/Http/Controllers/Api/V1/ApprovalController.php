<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderApproval;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnApproval;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseRequisitionApproval;
use App\Models\VendorInvoice;
use App\Models\VendorInvoiceApproval;
use App\Models\VendorPaymentBatch;
use App\Models\VendorPaymentBatchApproval;
use App\Models\VendorPrepayment;
use App\Models\VendorPrepaymentApproval;
use App\Services\ProcurementReturnService;
use App\Services\PurchaseService;
use App\Services\VendorInvoiceService;
use App\Services\VendorPaymentBatchService;
use App\Services\VendorPrepaymentService;
use App\Services\ApprovalGovernanceService;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalController extends Controller
{
    public function __construct(
        private PurchaseService $purchases,
        private ProcurementReturnService $returns,
        private VendorInvoiceService $invoices,
        private VendorPaymentBatchService $paymentBatches,
        private VendorPrepaymentService $prepayments,
        private ApprovalGovernanceService $governance,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('approvals', 'view');

        $userId = (int) $request->user()->id;
        $companyId = (int) (CurrentCompany::company()?->id ?? 0);
        $assigneeIds = $companyId > 0
            ? $this->governance->inboxAssigneeUserIds($companyId, $userId)
            : [$userId];

        $pendingPr = PurchaseRequisitionApproval::query()
            ->whereIn('user_id', $assigneeIds)
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
            ->whereIn('user_id', $assigneeIds)
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

        $items = $prItems->concat($poItems);

        $pendingReturn = PurchaseReturnApproval::query()
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->with(['purchaseReturn.user:id,name', 'purchaseReturn.supplier:id,name', 'purchaseReturn.approvals.user:id,name'])
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->filter(function (PurchaseReturnApproval $row) {
                $doc = $row->purchaseReturn;
                if (! $doc || $doc->status !== 'submitted') {
                    return false;
                }

                return (int) $doc->current_approval_level === (int) $row->level;
            })
            ->values();

        $returnItems = $pendingReturn->map(function (PurchaseReturnApproval $row) {
            /** @var PurchaseReturn $doc */
            $doc = $row->purchaseReturn;

            return [
                'type' => 'purchase_return',
                'id' => $doc->id,
                'title' => $doc->number,
                'subtitle' => $doc->user?->name,
                'level' => (int) $row->level,
                'status' => $doc->status,
                'created_at' => $doc->created_at?->toIso8601String(),
                'can_approve' => true,
                'payload' => $this->returns->serialize($doc),
            ];
        });

        $pendingInvoice = VendorInvoiceApproval::query()
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->with(['vendorInvoice.user:id,name', 'vendorInvoice.supplier:id,name', 'vendorInvoice.approvals.user:id,name'])
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->filter(function (VendorInvoiceApproval $row) {
                $doc = $row->vendorInvoice;
                if (! $doc || $doc->status !== 'submitted') {
                    return false;
                }

                return (int) $doc->current_approval_level === (int) $row->level;
            })
            ->values();

        $invoiceItems = $pendingInvoice->map(function (VendorInvoiceApproval $row) {
            /** @var VendorInvoice $doc */
            $doc = $row->vendorInvoice;

            return [
                'type' => 'vendor_invoice',
                'id' => $doc->id,
                'title' => $doc->number,
                'subtitle' => $doc->user?->name,
                'level' => (int) $row->level,
                'status' => $doc->status,
                'created_at' => $doc->created_at?->toIso8601String(),
                'can_approve' => true,
                'payload' => $this->invoices->serialize($doc),
            ];
        });

        $pendingBatch = VendorPaymentBatchApproval::query()
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->with(['batch.user:id,name', 'batch.approvals.user:id,name'])
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->filter(function (VendorPaymentBatchApproval $row) {
                $doc = $row->batch;
                if (! $doc || $doc->status !== 'submitted') {
                    return false;
                }

                return (int) $doc->current_approval_level === (int) $row->level;
            })
            ->values();

        $batchItems = $pendingBatch->map(function (VendorPaymentBatchApproval $row) {
            /** @var VendorPaymentBatch $doc */
            $doc = $row->batch;

            return [
                'type' => 'vendor_payment_batch',
                'id' => $doc->id,
                'title' => $doc->number,
                'subtitle' => $doc->user?->name,
                'level' => (int) $row->level,
                'status' => $doc->status,
                'created_at' => $doc->created_at?->toIso8601String(),
                'can_approve' => true,
                'payload' => $this->paymentBatches->serialize($doc),
            ];
        });

        $pendingPrepayment = VendorPrepaymentApproval::query()
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->with(['prepayment.user:id,name', 'prepayment.supplier:id,name', 'prepayment.approvals.user:id,name'])
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->filter(function (VendorPrepaymentApproval $row) {
                $doc = $row->prepayment;
                if (! $doc || $doc->status !== 'submitted') {
                    return false;
                }

                return (int) $doc->current_approval_level === (int) $row->level;
            })
            ->values();

        $prepaymentItems = $pendingPrepayment->map(function (VendorPrepaymentApproval $row) {
            /** @var VendorPrepayment $doc */
            $doc = $row->prepayment;

            return [
                'type' => 'vendor_prepayment',
                'id' => $doc->id,
                'title' => $doc->number,
                'subtitle' => $doc->user?->name,
                'level' => (int) $row->level,
                'status' => $doc->status,
                'created_at' => $doc->created_at?->toIso8601String(),
                'can_approve' => true,
                'payload' => $this->prepayments->serialize($doc),
            ];
        });

        $items = $items->concat($returnItems)
            ->concat($invoiceItems)
            ->concat($batchItems)
            ->concat($prepaymentItems)
            ->sortByDesc(fn (array $row) => $row['created_at'] ?? '')
            ->values();

        return $this->ok($items);
    }
}
