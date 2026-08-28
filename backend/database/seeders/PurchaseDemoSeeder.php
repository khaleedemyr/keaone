<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Contact;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseRequisitionApproval;
use App\Models\PurchaseRequisitionItem;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

class PurchaseDemoSeeder extends Seeder
{
    public function run(): void
    {
        $owner = User::query()->where('email', 'owner@demo.test')->first();
        if (! $owner) {
            $this->command?->warn('owner@demo.test belum ada. Jalankan DemoSeeder dulu.');

            return;
        }

        $admin = User::query()->where('email', 'admin@demo.test')->first() ?? $owner;

        $companies = Company::query()
            ->whereIn('name', ['Toko Demo', 'Cafe Demo'])
            ->orderBy('id')
            ->get();

        if ($companies->isEmpty()) {
            $this->command?->warn('Toko Demo / Cafe Demo belum ada. Jalankan DemoSeeder dulu.');

            return;
        }

        foreach ($companies as $index => $company) {
            $this->seedCompany($company, $owner, $admin, $index + 1);
        }
    }

    private function seedCompany(Company $company, User $owner, User $admin, int $companyIndex): void
    {
        $company->modules = array_merge($company->defaultModules(), $company->modules ?? [], [
            'purchase' => true,
        ]);
        $company->settings = array_merge($company->defaultSettings(), $company->settings ?? [], [
            'purchase_flow' => 'strict_pr_po_gr',
            'purchase_update_cost' => true,
            'pr_need_approval' => true,
        ]);
        $company->save();

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

        $suffix = str_pad((string) $companyIndex, 2, '0', STR_PAD_LEFT);
        $isCafe = $company->name === 'Cafe Demo';

        $suppliers = $isCafe
            ? [
                [
                    'phone' => '081200000101',
                    'name' => 'PT Supplier A',
                    'email' => 'order@supplier-a.test',
                    'payment_term' => 'net30',
                    'payment_days' => 30,
                    'is_taxable' => true,
                    'tax_percent' => 11,
                ],
                [
                    'phone' => '081200000102',
                    'name' => 'CV Bahan Kopi',
                    'email' => 'sales@bahankopi.test',
                    'payment_term' => 'net14',
                    'payment_days' => 14,
                    'is_taxable' => false,
                    'tax_percent' => null,
                ],
            ]
            : [
                [
                    'phone' => '0215550101',
                    'name' => 'PT Sumber Jaya',
                    'email' => 'beli@sumberjaya.test',
                    'payment_term' => 'net30',
                    'payment_days' => 30,
                    'is_taxable' => true,
                    'tax_percent' => 11,
                ],
                [
                    'phone' => '0215550102',
                    'name' => 'CV Logistik Barokah',
                    'email' => 'info@barokah.test',
                    'payment_term' => 'net45',
                    'payment_days' => 45,
                    'is_taxable' => false,
                    'tax_percent' => null,
                ],
            ];

        foreach ($suppliers as $row) {
            Contact::query()->updateOrCreate(
                [
                    'company_id' => $company->id,
                    'phone' => $row['phone'],
                ],
                [
                    'type' => 'supplier',
                    'name' => $row['name'],
                    'email' => $row['email'],
                    'address' => $isCafe ? 'Jl. Braga No. 20, Bandung' : 'Jl. Industri Raya No. 8, Jakarta',
                    'city' => $isCafe ? 'Bandung' : 'Jakarta Utara',
                    'province' => $isCafe ? 'Jawa Barat' : 'DKI Jakarta',
                    'payment_term' => $row['payment_term'],
                    'payment_days' => $row['payment_days'],
                    'is_taxable' => $row['is_taxable'],
                    'tax_percent' => $row['tax_percent'],
                    'is_active' => true,
                ],
            );
        }

        $products = Product::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('id')
            ->limit($isCafe ? 3 : 4)
            ->get();

        if ($products->isEmpty()) {
            $this->command?->warn("{$company->name}: belum ada produk, PR dilewati.");

            return;
        }

        $pr = $this->seedApprovedPr(
            company: $company,
            outlet: $outlet,
            warehouse: $warehouse,
            requester: $owner,
            clientUuid: sprintf('b2222222-2222-4222-8222-%010d%02d', $company->id, 1),
            number: "PR-PO-READY-{$suffix}",
            note: "Siap dibuatkan PO ({$company->name}) — seeder PurchaseDemo.",
            products: $products,
            owner: $owner,
            admin: $admin,
        );

        $this->command?->info("{$company->name}:");
        foreach ($suppliers as $supplier) {
            $tax = $supplier['is_taxable'] ? " · pajak {$supplier['tax_percent']}%" : '';
            $this->command?->info("  supplier: {$supplier['name']} · TOP {$supplier['payment_term']}{$tax}");
        }
        $this->command?->info("  PR siap PO: {$pr->number}");
    }

    private function seedApprovedPr(
        Company $company,
        Outlet $outlet,
        Warehouse $warehouse,
        User $requester,
        string $clientUuid,
        string $number,
        string $note,
        $products,
        User $owner,
        User $admin,
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
                'status' => 'approved',
                'needed_at' => now()->addDays(7)->toDateString(),
                'note' => $note,
                'approved_by' => $admin->id,
                'approved_at' => now()->subMinutes(15),
                'current_approval_level' => null,
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

        foreach ([
            [
                'level' => 1,
                'user' => $owner,
                'status' => 'approved',
                'acted_by' => $owner->id,
                'acted_at' => now()->subHours(2),
            ],
            [
                'level' => 2,
                'user' => $admin,
                'status' => 'approved',
                'acted_by' => $admin->id,
                'acted_at' => now()->subMinutes(15),
            ],
        ] as $row) {
            PurchaseRequisitionApproval::query()->create([
                'company_id' => $company->id,
                'purchase_requisition_id' => $pr->id,
                'level' => $row['level'],
                'user_id' => $row['user']->id,
                'status' => $row['status'],
                'acted_by' => $row['acted_by'],
                'acted_at' => $row['acted_at'],
            ]);
        }

        return $pr;
    }
}
