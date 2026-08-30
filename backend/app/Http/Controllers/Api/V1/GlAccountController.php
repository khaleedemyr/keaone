<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GlAccount;
use App\Services\GlAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class GlAccountController extends Controller
{
    public function __construct(private GlAccountService $accounts) {}

    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny([
                ['glaccounts', 'view'],
                ['purchasesettings', 'view'],
                ['purchasesettings', 'edit'],
            ]);
        } else {
            $this->ensureCan('glaccounts', 'view');
        }

        $query = GlAccount::query()->orderBy('code');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        if ($type = $request->string('account_type')->toString()) {
            if ($type !== 'all') {
                $query->where('account_type', $type);
            }
        }

        $this->applyActiveStatus($query, $request);

        if ($request->boolean('for_select')) {
            $rows = $query->get()->map(fn (GlAccount $row) => $this->accounts->serialize($row))->values();

            return $this->ok($rows);
        }

        $page = $query->paginate($this->perPage($request, 50));

        return $this->ok(
            $page->getCollection()->map(fn (GlAccount $row) => $this->accounts->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('glaccounts', 'create');

        $data = $request->validate(GlAccount::rules());
        $account = GlAccount::query()->create($data);

        return $this->ok($this->accounts->serialize($account), [], 201);
    }

    public function update(Request $request, GlAccount $glAccount): JsonResponse
    {
        $this->ensureCan('glaccounts', 'edit');

        $data = $request->validate(GlAccount::rules(true));
        if ($glAccount->is_system && array_key_exists('code', $data) && $data['code'] !== $glAccount->code) {
            throw ValidationException::withMessages(['code' => ['Akun sistem tidak bisa ubah kode.']]);
        }

        $glAccount->update($data);

        return $this->ok($this->accounts->serialize($glAccount->fresh()));
    }

    public function destroy(GlAccount $glAccount): JsonResponse
    {
        $this->ensureCanAny([['glaccounts', 'delete'], ['glaccounts', 'edit']]);

        if ($glAccount->is_system) {
            throw ValidationException::withMessages(['account' => ['Akun sistem tidak bisa dinonaktifkan.']]);
        }

        $glAccount->update(['is_active' => false]);

        return $this->ok($this->accounts->serialize($glAccount->fresh()));
    }
}
