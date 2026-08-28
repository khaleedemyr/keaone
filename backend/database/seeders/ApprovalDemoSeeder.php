<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseRequisitionApproval;
use App\Models\PurchaseRequisitionItem;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\Warehouse;
use App\Services\RoleService;
use Illuminate\Database\Seeder;

class ApprovalDemoSeeder extends Seeder
{
    public function run(): void
    {
        $owner = User::query()->where('email', 'owner@demo.test')->first();
        $cashier = User::query()->where('email', 'kasir@demo.test')->first();

        if (! $owner) {
            $this->command?->warn('owner@demo.test belum ada. Jalankan DemoSeeder dulu.');

            return;
        }

        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@demo.test'],
            [
                'name' => 'Admin Demo',
                'username' => 'admin',
                'password' => 'password',
            ],
        );

        // Requester fallback: cashier jika ada di company, else owner.
        $companies = Company::query()
            ->whereIn('name', ['Toko Demo', 'Cafe Demo'])
            ->orderBy('id')
            ->get();

        if ($companies->isEmpty()) {
            $this->command?->warn('Toko Demo / Cafe Demo belum ada. Jalankan DemoSeeder dulu.');

            return;
        }

        foreach ($companies as $index => $company) {
            $this->seedCompany(
                $company,
                $owner,
                $admin,
                $cashier,
                $index + 1,
            );
        }
    }

    private function seedCompany(
        Company $company,
        User $owner,
        User $admin,
        ?User $cashier,
        int $companyIndex,
    ): void {
        $outlet = Outlet::query()
            ->where('company_id', $company->id)
            ->where('is_default', true)
            ->first()
            ?? Outlet::query()->where('company_id', $company->id)->first();

        $warehouse = Warehouse::query()
            ->where('company_id', $company->id)
            ->where('is_default', true)
            ->first()
            ?? Warehouse::query()->where('company_id', $company->id)->first();

        if (! $outlet || ! $warehouse) {
            $this->command?->warn("{$company->name}: outlet/gudang belum lengkap, dilewati.");

            return;
        }

        // Pastikan owner & admin aktif di company ini.
        foreach ([['user' => $owner, 'role' => 'owner'], ['user' => $admin, 'role' => 'admin']] as $row) {
            CompanyUser::query()->firstOrCreate(
                [
                    'company_id' => $company->id,
                    'user_id' => $row['user']->id,
                ],
                [
                    'outlet_id' => $outlet->id,
                    'role' => $row['role'],
                    'is_active' => true,
                ],
            );
        }

        $requester = $cashier;
        if ($requester) {
            CompanyUser::query()->firstOrCreate(
                [
                    'company_id' => $company->id,
                    'user_id' => $requester->id,
                ],
                [
                    'outlet_id' => $outlet->id,
                    'role' => 'cashier',
                    'is_active' => true,
                ],
            );
        } else {
            $requester = $owner;
        }

        app(RoleService::class)->ensureTenantRoles($company);

        $company->modules = array_merge($company->defaultModules(), $company->modules ?? [], [
            'purchase' => true,
        ]);
        $company->settings = array_merge($company->defaultSettings(), $company->settings ?? [], [
            'purchase_flow' => 'strict_pr_po_gr',
            'purchase_update_cost' => true,
            'pr_need_approval' => true,
        ]);
        $company->save();

        $products = Product::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('id')
            ->limit(3)
            ->get();

        if ($products->isEmpty()) {
            $this->command?->warn("{$company->name}: belum ada produk, dilewati.");

            return;
        }

        $suffix = str_pad((string) $companyIndex, 2, '0', STR_PAD_LEFT);

        $pr1 = $this->seedPr(
            company: $company,
            outlet: $outlet,
            warehouse: $warehouse,
            requester: $requester,
            clientUuid: sprintf('a1111111-1111-4111-8111-%010d%02d', $company->id, 1),
            number: "PR-DEMO-{$suffix}01",
            note: "Restock ({$company->name}) — contoh approval level 1 (owner).",
            status: 'submitted',
            currentLevel: 1,
            products: $products,
            levels: [
                ['level' => 1, 'user' => $owner, 'status' => 'pending'],
                ['level' => 2, 'user' => $admin, 'status' => 'pending'],
            ],
        );

        $pr2 = $this->seedPr(
            company: $company,
            outlet: $outlet,
            warehouse: $warehouse,
            requester: $requester,
            clientUuid: sprintf('a1111111-1111-4111-8111-%010d%02d', $company->id, 2),
            number: "PR-DEMO-{$suffix}02",
            note: "Pengadaan mendesak ({$company->name}) — contoh approval level 2 (admin).",
            status: 'submitted',
            currentLevel: 2,
            products: $products->take(2),
            levels: [
                [
                    'level' => 1,
                    'user' => $owner,
                    'status' => 'approved',
                    'acted_by' => $owner->id,
                    'acted_at' => now()->subHours(2),
                ],
                ['level' => 2, 'user' => $admin, 'status' => 'pending'],
            ],
        );

        // Sudah fully approved → muncul di dropdown "Dari PR" saat buat PO.
        $pr3 = $this->seedPr(
            company: $company,
            outlet: $outlet,
            warehouse: $warehouse,
            requester: $requester,
            clientUuid: sprintf('a1111111-1111-4111-8111-%010d%02d', $company->id, 3),
            number: "PR-DEMO-{$suffix}03",
            note: "Siap dibuatkan PO ({$company->name}) — sudah fully approved.",
            status: 'approved',
            currentLevel: null,
            approvedBy: $admin->id,
            approvedAt: now()->subMinutes(30),
            products: $products,
            levels: [
                [
                    'level' => 1,
                    'user' => $owner,
                    'status' => 'approved',
                    'acted_by' => $owner->id,
                    'acted_at' => now()->subHours(3),
                ],
                [
                    'level' => 2,
                    'user' => $admin,
                    'status' => 'approved',
                    'acted_by' => $admin->id,
                    'acted_at' => now()->subMinutes(30),
                ],
            ],
        );

        $this->seedNotif(
            $company->id,
            $owner->id,
            'notifPrApprovalNeededTitle',
            'notifPrApprovalNeededBody',
            [
                'number' => $pr1->number,
                'requester' => $requester->name,
                'level' => '1',
            ],
            ['type' => 'purchase_requisition', 'id' => $pr1->id, 'app' => 'approvals'],
        );

        $this->seedNotif(
            $company->id,
            $admin->id,
            'notifPrApprovalNeededTitle',
            'notifPrApprovalNeededBody',
            [
                'number' => $pr2->number,
                'requester' => $requester->name,
                'level' => '2',
            ],
            ['type' => 'purchase_requisition', 'id' => $pr2->id, 'app' => 'approvals'],
        );

        $this->command?->info("{$company->name}:");
        $this->command?->info("  pending L1: {$pr1->number} (owner)");
        $this->command?->info("  pending L2: {$pr2->number} (admin)");
        $this->command?->info("  approved → PO: {$pr3->number}");
    }

    /**
     * @param  list<array{level: int, user: User, status: string, acted_by?: int|null, acted_at?: mixed}>  $levels
     */
    private function seedPr(
        Company $company,
        Outlet $outlet,
        Warehouse $warehouse,
        User $requester,
        string $clientUuid,
        string $number,
        string $note,
        string $status,
        ?int $currentLevel,
        $products,
        array $levels,
        ?int $approvedBy = null,
        mixed $approvedAt = null,
    ): PurchaseRequisition {
        $pr = PurchaseRequisition::query()->updateOrCreate(
            [
                'company_id' => $company->id,
                'client_uuid' => $clientUuid,
            ],
            [
                'outlet_id' => $outlet->id,
                'warehouse_id' => $warehouse->id,
                'user_id' => $requester->id,
                'number' => $number,
                'status' => $status,
                'needed_at' => now()->addDays(7)->toDateString(),
                'note' => $note,
                'approved_by' => $approvedBy,
                'approved_at' => $approvedAt,
                'current_approval_level' => $currentLevel,
            ],
        );

        PurchaseRequisitionItem::query()->where('purchase_requisition_id', $pr->id)->delete();
        PurchaseRequisitionApproval::query()->where('purchase_requisition_id', $pr->id)->delete();

        $qty = 10;
        foreach ($products as $product) {
            PurchaseRequisitionItem::query()->create([
                'company_id' => $company->id,
                'purchase_requisition_id' => $pr->id,
                'product_id' => $product->id,
                'qty' => $qty,
                'unit' => $product->unit ?? 'pcs',
                'unit_level' => 'small',
                'factor_to_base' => 1,
                'name_snapshot' => $product->name,
            ]);
            $qty += 5;
        }

        foreach ($levels as $row) {
            PurchaseRequisitionApproval::query()->create([
                'company_id' => $company->id,
                'purchase_requisition_id' => $pr->id,
                'level' => $row['level'],
                'user_id' => $row['user']->id,
                'status' => $row['status'],
                'acted_by' => $row['acted_by'] ?? null,
                'acted_at' => $row['acted_at'] ?? null,
            ]);
        }

        return $pr;
    }

    /**
     * @param  array<string, string>  $params
     * @param  array<string, mixed>  $meta
     */
    private function seedNotif(
        int $companyId,
        int $userId,
        string $titleKey,
        string $bodyKey,
        array $params,
        array $meta,
    ): void {
        $exists = UserNotification::query()
            ->where('company_id', $companyId)
            ->where('user_id', $userId)
            ->where('title_key', $titleKey)
            ->where('body_key', $bodyKey)
            ->where('params->number', $params['number'] ?? '')
            ->exists();

        if ($exists) {
            return;
        }

        UserNotification::query()->create([
            'company_id' => $companyId,
            'user_id' => $userId,
            'tone' => 'info',
            'title_key' => $titleKey,
            'body_key' => $bodyKey,
            'params' => $params,
            'meta' => $meta,
            'read_at' => null,
        ]);
    }
}
