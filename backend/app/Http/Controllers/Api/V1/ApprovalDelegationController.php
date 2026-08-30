<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApprovalDelegation;
use App\Services\ApprovalGovernanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalDelegationController extends Controller
{
    public function __construct(private ApprovalGovernanceService $governance) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('approvaldelegations', 'view');

        $query = ApprovalDelegation::query()->orderByDesc('starts_at')->orderByDesc('id');

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($userId = $request->integer('user_id')) {
            $query->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)->orWhere('delegate_user_id', $userId);
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (ApprovalDelegation $row) => $this->governance->serializeDelegation($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function show(ApprovalDelegation $approvalDelegation): JsonResponse
    {
        $this->ensureCan('approvaldelegations', 'view');

        return $this->ok($this->governance->serializeDelegation($approvalDelegation));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('approvaldelegations', 'create');

        $data = $request->validate(ApprovalDelegation::rules());
        $data['is_active'] = $data['is_active'] ?? true;

        $row = ApprovalDelegation::query()->create($data);

        return $this->ok($this->governance->serializeDelegation($row->fresh()), [], 201);
    }

    public function update(Request $request, ApprovalDelegation $approvalDelegation): JsonResponse
    {
        $this->ensureCan('approvaldelegations', 'edit');

        $data = $request->validate(ApprovalDelegation::rules(true));
        $approvalDelegation->update($data);

        return $this->ok($this->governance->serializeDelegation($approvalDelegation->fresh()));
    }

    public function destroy(ApprovalDelegation $approvalDelegation): JsonResponse
    {
        $this->ensureCan('approvaldelegations', 'delete');

        $approvalDelegation->delete();

        return $this->ok(['deleted' => true]);
    }
}
