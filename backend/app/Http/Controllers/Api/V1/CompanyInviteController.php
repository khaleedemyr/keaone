<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanyInvite;
use App\Services\CompanyInviteService;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CompanyInviteController extends Controller
{
    public function __construct(private CompanyInviteService $invites) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('users', 'view');

        $query = CompanyInvite::query()
            ->where('company_id', CurrentCompany::id())
            ->with(['roleRecord', 'creator'])
            ->orderByDesc('id');

        if ($request->boolean('active_only', true)) {
            $query->whereNull('revoked_at')
                ->where(function ($q) {
                    $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
                })
                ->where(function ($q) {
                    $q->whereNull('max_uses')->orWhereColumn('use_count', '<', 'max_uses');
                });
        }

        return $this->paged($query, $request, fn (CompanyInvite $row) => $this->invites->serialize($row));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('users', 'create');

        $data = $request->validate([
            'role_id' => ['nullable', 'integer'],
            'role' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:150'],
            'label' => ['nullable', 'string', 'max:120'],
            'max_uses' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'expires_in_days' => ['nullable', Rule::in([7, 30, 90, -1])],
        ]);

        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Perusahaan tidak ditemukan.');

        $invite = $this->invites->create($company, $request->user(), $data);
        $invite->load(['roleRecord', 'creator']);

        return $this->ok($this->invites->serialize($invite), [], 201);
    }

    public function destroy(CompanyInvite $invite): JsonResponse
    {
        $this->ensureCanAny([['users', 'delete'], ['users', 'edit']]);

        abort_unless($invite->company_id === CurrentCompany::id(), 404);

        if (! $invite->isRevoked()) {
            $invite->update(['revoked_at' => now()]);
        }

        $invite->load(['roleRecord', 'creator']);

        return $this->ok($this->invites->serialize($invite->fresh()));
    }
}
