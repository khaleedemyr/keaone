<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApprovalMatrixRule;
use App\Services\ApprovalGovernanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalMatrixController extends Controller
{
    public function __construct(private ApprovalGovernanceService $governance) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('approvalmatrix', 'view');

        $query = ApprovalMatrixRule::query()
            ->orderBy('doc_type')
            ->orderBy('level')
            ->orderByDesc('priority')
            ->orderBy('id');

        if ($docType = $request->string('doc_type')->toString()) {
            if ($docType !== 'all') {
                $query->where('doc_type', $docType);
            }
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (ApprovalMatrixRule $row) => $this->governance->serializeMatrixRule($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function show(ApprovalMatrixRule $approvalMatrixRule): JsonResponse
    {
        $this->ensureCan('approvalmatrix', 'view');

        return $this->ok($this->governance->serializeMatrixRule($approvalMatrixRule));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('approvalmatrix', 'create');

        $data = $request->validate(ApprovalMatrixRule::rules());
        $data['min_amount'] = (int) ($data['min_amount'] ?? 0);
        $data['priority'] = (int) ($data['priority'] ?? 0);
        $data['is_active'] = $data['is_active'] ?? true;

        $rule = ApprovalMatrixRule::query()->create($data);

        return $this->ok($this->governance->serializeMatrixRule($rule->fresh()), [], 201);
    }

    public function update(Request $request, ApprovalMatrixRule $approvalMatrixRule): JsonResponse
    {
        $this->ensureCan('approvalmatrix', 'edit');

        $data = $request->validate(ApprovalMatrixRule::rules(true));
        if (array_key_exists('min_amount', $data)) {
            $data['min_amount'] = (int) $data['min_amount'];
        }
        if (array_key_exists('priority', $data)) {
            $data['priority'] = (int) $data['priority'];
        }

        $approvalMatrixRule->update($data);

        return $this->ok($this->governance->serializeMatrixRule($approvalMatrixRule->fresh()));
    }

    public function destroy(ApprovalMatrixRule $approvalMatrixRule): JsonResponse
    {
        $this->ensureCan('approvalmatrix', 'delete');

        $approvalMatrixRule->delete();

        return $this->ok(['deleted' => true]);
    }
}
