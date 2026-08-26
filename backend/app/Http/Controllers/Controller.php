<?php

namespace App\Http\Controllers;

use App\Support\Access;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

abstract class Controller
{
    protected function ok(mixed $data = [], array $meta = [], int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data,
            'meta' => $meta === [] ? (object) [] : $meta,
        ], $status);
    }

    protected function perPage(Request $request, int $default = 20): int
    {
        return min(max($request->integer('per_page', $default), 1), 100);
    }

    /**
     * @return array{current_page: int, last_page: int, total: int, per_page: int}
     */
    protected function pageMeta(LengthAwarePaginator $page): array
    {
        return [
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
            'per_page' => $page->perPage(),
        ];
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\Illuminate\Database\Eloquent\Model>  $query
     */
    protected function applyActiveStatus($query, Request $request, bool $defaultActiveOnly = false): void
    {
        $status = strtolower($request->string('status')->toString());

        if ($status === 'all') {
            return;
        }

        if ($status === 'inactive') {
            $query->where('is_active', false);

            return;
        }

        if ($status === 'active') {
            $query->where('is_active', true);

            return;
        }

        if ($request->boolean('active_only', $defaultActiveOnly)) {
            $query->where('is_active', true);
        }
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\Illuminate\Database\Eloquent\Model>  $query
     */
    protected function paged($query, Request $request, ?callable $map = null, int $default = 20): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $items = $query->limit(200)->get();

            return $this->ok($map ? $items->map($map)->values() : $items);
        }

        $page = $query->paginate($this->perPage($request, $default));
        $items = $page->getCollection();

        return $this->ok($map ? $items->map($map)->values() : $items, $this->pageMeta($page));
    }

    protected function error(string $message, array $errors = [], int $status = 422): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'errors' => $errors === [] ? (object) [] : $errors,
        ], $status);
    }

    protected function ensureRole(array $roles): void
    {
        if (CurrentCompany::isPlatform()) {
            return;
        }

        if (Access::isOwner()) {
            return;
        }

        $role = CurrentCompany::role();

        abort_unless($role && in_array($role, $roles, true), 403, 'Tidak punya akses.');
    }

    protected function ensureCan(string $menu, string $action = 'view'): void
    {
        if (CurrentCompany::isPlatform()) {
            return;
        }

        abort_unless(Access::can($menu, $action), 403, 'Tidak punya akses.');
    }

    /**
     * @param  list<string|array{0: string, 1?: string}>  $checks
     */
    protected function ensureCanAny(array $checks): void
    {
        if (CurrentCompany::isPlatform()) {
            return;
        }

        foreach ($checks as $check) {
            $menu = is_array($check) ? $check[0] : $check;
            $action = is_array($check) ? ($check[1] ?? 'view') : 'view';
            if (Access::can($menu, $action)) {
                return;
            }
        }

        abort(403, 'Tidak punya akses.');
    }

    protected function ensurePlatformCan(string $menu, string $action = 'view'): void
    {
        abort_unless(Access::canPlatform($menu, $action), 403, 'Tidak punya akses.');
    }

    protected function ensureModule(string $module): void
    {
        abort_unless(\App\Support\CurrentCompany::hasModule($module), 403, 'Modul tidak aktif.');
    }

    protected function ensureBilling(): void
    {
        if (\App\Support\CurrentCompany::isPlatform()) {
            return;
        }

        $company = \App\Support\CurrentCompany::company();
        $subscription = $company?->subscription;
        if ($subscription) {
            app(\App\Services\BillingService::class)->refresh($subscription);
            $subscription->refresh();
        }

        abort_unless($subscription?->isUsable(), 402, 'Langganan tidak aktif. Selesaikan tagihan di Billing.');
    }

    protected function ensurePlanLimit(string $kind): void
    {
        if (\App\Support\CurrentCompany::isPlatform()) {
            return;
        }

        $plan = \App\Support\CurrentCompany::company()?->subscription?->plan;
        if (! $plan) {
            return;
        }

        if ($kind === 'users' && $plan->max_users) {
            $count = \App\Models\CompanyUser::query()
                ->where('company_id', \App\Support\CurrentCompany::id())
                ->where('is_active', true)
                ->count();
            abort_unless($count < $plan->max_users, 422, 'Paket ini membatasi jumlah pengguna.');
        }

        if ($kind === 'outlets' && $plan->max_outlets) {
            $count = \App\Models\Outlet::query()->where('is_active', true)->count();
            abort_unless($count < $plan->max_outlets, 422, 'Paket ini membatasi jumlah outlet.');
        }
    }

    protected function platformRole(): string
    {
        $user = auth()->user();
        if (! $user?->is_platform) {
            return '';
        }

        return $user->platform_role ?: 'owner';
    }

    protected function ensurePlatformRole(array $roles): void
    {
        abort_unless(in_array($this->platformRole(), $roles, true), 403, 'Tidak punya akses.');
    }
}
