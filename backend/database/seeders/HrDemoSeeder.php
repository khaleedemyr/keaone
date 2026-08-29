<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Department;
use App\Models\JobLevel;
use App\Models\Outlet;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use App\Services\RoleService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class HrDemoSeeder extends Seeder
{
    /** @var array<string, Department> */
    private array $departments = [];

    /** @var array<string, Position> */
    private array $positions = [];

    /** @var array<string, JobLevel> */
    private array $jobLevels = [];

    /** @var array<string, CompanyUser> */
    private array $members = [];

    public function run(): void
    {
        $companies = Company::query()
            ->whereIn('name', ['Toko Demo', 'Cafe Demo'])
            ->orderBy('id')
            ->get();

        if ($companies->isEmpty()) {
            $this->command?->warn('Toko Demo / Cafe Demo belum ada. Jalankan DemoSeeder dulu.');

            return;
        }

        $roleService = app(RoleService::class);
        foreach ($companies as $company) {
            $roleService->ensureTenantRoles($company);
        }

        $toko = $companies->firstWhere('name', 'Toko Demo');
        $cafe = $companies->firstWhere('name', 'Cafe Demo');

        if ($toko) {
            $this->seedTokoDemo($toko);
        }

        if ($cafe) {
            $this->seedCafeDemo($cafe);
        }

        // Satu akun dipakai di kedua perusahaan (contoh invite email existing).
        if ($toko && $cafe) {
            $shared = User::query()->where('email', 'finance@demo.test')->first();
            if ($shared) {
                $this->syncMember($cafe, $shared, 'viewer', [
                    'employee_code' => 'CF-013',
                    'department' => 'Keuangan',
                    'position' => 'Staff Keuangan',
                    'job_level' => 'Staff',
                    'hired_at' => '2023-04-01',
                    'manager_email' => 'manager@demo.test',
                    'outlet_id' => Outlet::query()->where('company_id', $cafe->id)->where('is_default', true)->value('id'),
                ]);
            }
        }

        $this->command?->info('HrDemoSeeder: master HR + karyawan demo siap.');
        $this->command?->info('Semua password demo: password');
    }

    private function seedTokoDemo(Company $company): void
    {
        $outletMain = Outlet::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Utama'],
            ['address' => 'Jl. Merdeka No. 1, Jakarta', 'is_default' => true, 'is_active' => true],
        );

        $outletBranch = Outlet::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Cabang Bekasi'],
            ['address' => 'Jl. Ahmad Yani No. 45, Bekasi', 'is_default' => false, 'is_active' => true],
        );

        $this->seedOrgMaster($company, [
            'departments' => [
                ['key' => 'direksi', 'name' => 'Direksi', 'code' => 'DIR', 'sort' => 1],
                ['key' => 'operasional', 'name' => 'Operasional', 'code' => 'OPS', 'parent' => 'direksi', 'sort' => 2],
                ['key' => 'keuangan', 'name' => 'Keuangan', 'code' => 'FIN', 'parent' => 'direksi', 'sort' => 3],
                ['key' => 'gudang', 'name' => 'Gudang & Logistik', 'code' => 'WH', 'parent' => 'operasional', 'sort' => 4],
                ['key' => 'penjualan', 'name' => 'Penjualan & Kasir', 'code' => 'SLS', 'parent' => 'operasional', 'sort' => 5],
            ],
            'positions' => [
                ['key' => 'direktur', 'name' => 'Direktur', 'code' => 'DIR', 'rank' => 100, 'sort' => 1],
                ['key' => 'manager_ops', 'name' => 'Manager Operasional', 'code' => 'MOP', 'rank' => 80, 'sort' => 2],
                ['key' => 'supervisor', 'name' => 'Supervisor Toko', 'code' => 'SPV', 'rank' => 60, 'sort' => 3],
                ['key' => 'admin_fin', 'name' => 'Admin Keuangan', 'code' => 'AFN', 'rank' => 50, 'sort' => 4],
                ['key' => 'staff_gudang', 'name' => 'Staff Gudang', 'code' => 'WH', 'rank' => 40, 'sort' => 5],
                ['key' => 'kasir', 'name' => 'Kasir', 'code' => 'KSR', 'rank' => 20, 'sort' => 6],
            ],
            'job_levels' => [
                ['key' => 'director', 'name' => 'Director', 'code' => 'D', 'rank' => 100, 'sort' => 1],
                ['key' => 'manager', 'name' => 'Manager', 'code' => 'M', 'rank' => 80, 'sort' => 2],
                ['key' => 'supervisor', 'name' => 'Supervisor', 'code' => 'S', 'rank' => 60, 'sort' => 3],
                ['key' => 'staff', 'name' => 'Staff', 'code' => 'ST', 'rank' => 40, 'sort' => 4],
                ['key' => 'junior', 'name' => 'Junior', 'code' => 'J', 'rank' => 20, 'sort' => 5],
            ],
        ]);

        $employees = [
            ['email' => 'owner@demo.test', 'name' => 'Owner Demo', 'username' => 'owner', 'role' => 'owner', 'outlet' => $outletMain, 'code' => 'TK-001', 'dept' => 'Direksi', 'position' => 'Direktur', 'level' => 'Director', 'hired' => '2020-01-15', 'manager' => null, 'biodata' => ['national_id' => '3174011501850001', 'tax_id' => '12.345.678.9-012.000', 'birth_date' => '1985-01-15', 'birth_place' => 'Jakarta', 'gender' => 'male', 'marital_status' => 'married', 'address' => 'Jl. Merdeka No. 1, Jakarta Pusat', 'emergency_contact_name' => 'Siti Demo', 'emergency_contact_phone' => '081234567890'], 'contract_type' => 'permanent'],
            ['email' => 'admin@demo.test', 'name' => 'Admin Demo', 'username' => 'admin', 'role' => 'admin', 'outlet' => $outletMain, 'code' => 'TK-002', 'dept' => 'Keuangan', 'position' => 'Admin Keuangan', 'level' => 'Manager', 'hired' => '2021-03-01', 'manager' => 'owner@demo.test', 'biodata' => ['national_id' => '3174022002900002', 'birth_date' => '1990-02-20', 'birth_place' => 'Bandung', 'gender' => 'female', 'marital_status' => 'single'], 'contract_type' => 'permanent'],
            ['email' => 'ops@demo.test', 'name' => 'Agus Setiawan', 'username' => 'ops', 'role' => 'admin', 'outlet' => $outletMain, 'code' => 'TK-003', 'dept' => 'Operasional', 'position' => 'Manager Operasional', 'level' => 'Manager', 'hired' => '2021-06-10', 'manager' => 'owner@demo.test'],
            ['email' => 'supervisor@demo.test', 'name' => 'Rina Wijaya', 'username' => 'supervisor', 'role' => 'admin', 'outlet' => $outletMain, 'code' => 'TK-004', 'dept' => 'Operasional', 'position' => 'Supervisor Toko', 'level' => 'Supervisor', 'hired' => '2022-02-20', 'manager' => 'ops@demo.test'],
            ['email' => 'finance@demo.test', 'name' => 'Hendra Gunawan', 'username' => 'finance', 'role' => 'viewer', 'outlet' => $outletMain, 'code' => 'TK-005', 'dept' => 'Keuangan', 'position' => 'Admin Keuangan', 'level' => 'Staff', 'hired' => '2022-08-01', 'manager' => 'admin@demo.test'],
            ['email' => 'kasir@demo.test', 'name' => 'Kasir Demo', 'username' => 'kasir', 'role' => 'cashier', 'outlet' => $outletMain, 'code' => 'TK-006', 'dept' => 'Penjualan & Kasir', 'position' => 'Kasir', 'level' => 'Staff', 'hired' => '2023-01-05', 'manager' => 'supervisor@demo.test', 'biodata' => ['national_id' => '3174031005950006', 'birth_date' => '1995-05-10', 'birth_place' => 'Depok', 'gender' => 'male', 'marital_status' => 'single', 'address' => 'Jl. Margonda Raya No. 12, Depok'], 'contract_type' => 'permanent'],
            ['email' => 'kasir2@demo.test', 'name' => 'Siti Rahayu', 'username' => 'kasir2', 'role' => 'cashier', 'outlet' => $outletMain, 'code' => 'TK-007', 'dept' => 'Penjualan & Kasir', 'position' => 'Kasir', 'level' => 'Staff', 'hired' => '2023-05-12', 'manager' => 'supervisor@demo.test'],
            ['email' => 'kasir3@demo.test', 'name' => 'Dewi Lestari', 'username' => 'kasir3', 'role' => 'cashier', 'outlet' => $outletBranch, 'code' => 'TK-008', 'dept' => 'Penjualan & Kasir', 'position' => 'Kasir', 'level' => 'Junior', 'hired' => '2024-01-08', 'manager' => 'supervisor@demo.test', 'employment_status' => 'probation', 'contract_type' => 'contract', 'contract_end_at' => '2024-07-08'],
            ['email' => 'gudang1@demo.test', 'name' => 'Budi Pratama', 'username' => 'gudang1', 'role' => 'cashier', 'outlet' => $outletMain, 'code' => 'TK-009', 'dept' => 'Gudang & Logistik', 'position' => 'Staff Gudang', 'level' => 'Staff', 'hired' => '2022-11-01', 'manager' => 'ops@demo.test'],
            ['email' => 'gudang2@demo.test', 'name' => 'Andi Saputra', 'username' => 'gudang2', 'role' => 'cashier', 'outlet' => $outletMain, 'code' => 'TK-010', 'dept' => 'Gudang & Logistik', 'position' => 'Staff Gudang', 'level' => 'Junior', 'hired' => '2024-03-15', 'manager' => 'gudang1@demo.test'],
            ['email' => 'kasir4@demo.test', 'name' => 'Fitri Anggraini', 'username' => 'kasir4', 'role' => 'cashier', 'outlet' => $outletBranch, 'code' => 'TK-011', 'dept' => 'Penjualan & Kasir', 'position' => 'Kasir', 'level' => 'Junior', 'hired' => '2024-06-01', 'manager' => 'supervisor@demo.test'],
            ['email' => 'viewer@demo.test', 'name' => 'Dian Permata', 'username' => 'viewer', 'role' => 'viewer', 'outlet' => $outletMain, 'code' => 'TK-012', 'dept' => 'Keuangan', 'position' => 'Admin Keuangan', 'level' => 'Junior', 'hired' => '2024-09-01', 'manager' => 'finance@demo.test'],
            ['email' => 'resigned@demo.test', 'name' => 'Eko Prasetyo', 'username' => 'resigned', 'role' => 'viewer', 'outlet' => $outletMain, 'code' => 'TK-013', 'dept' => 'Penjualan & Kasir', 'position' => 'Kasir', 'level' => 'Staff', 'hired' => '2021-09-01', 'manager' => 'supervisor@demo.test', 'employment_status' => 'resigned', 'terminated_at' => '2024-11-30', 'is_active' => false, 'biodata' => ['national_id' => '3174041208870013', 'birth_date' => '1987-08-12', 'birth_place' => 'Tangerang', 'gender' => 'male']],
        ];

        $this->seedEmployees($company, $employees);
    }

    private function seedCafeDemo(Company $company): void
    {
        $outlet = Outlet::query()->firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Utama'],
            ['address' => 'Jl. Braga No. 8, Bandung', 'is_default' => true, 'is_active' => true],
        );

        $this->seedOrgMaster($company, [
            'departments' => [
                ['key' => 'manajemen', 'name' => 'Manajemen', 'code' => 'MGT', 'sort' => 1],
                ['key' => 'dapur', 'name' => 'Dapur', 'code' => 'KIT', 'parent' => 'manajemen', 'sort' => 2],
                ['key' => 'foh', 'name' => 'Front of House', 'code' => 'FOH', 'parent' => 'manajemen', 'sort' => 3],
                ['key' => 'keuangan', 'name' => 'Keuangan', 'code' => 'FIN', 'parent' => 'manajemen', 'sort' => 4],
            ],
            'positions' => [
                ['key' => 'direktur', 'name' => 'Direktur', 'code' => 'DIR', 'rank' => 100, 'sort' => 1],
                ['key' => 'manager', 'name' => 'Manager Outlet', 'code' => 'MGR', 'rank' => 80, 'sort' => 2],
                ['key' => 'chef', 'name' => 'Kepala Dapur', 'code' => 'CHF', 'rank' => 70, 'sort' => 3],
                ['key' => 'barista', 'name' => 'Barista', 'code' => 'BAR', 'rank' => 40, 'sort' => 4],
                ['key' => 'waiter', 'name' => 'Waiter / Pramusaji', 'code' => 'WTR', 'rank' => 30, 'sort' => 5],
                ['key' => 'kitchen', 'name' => 'Staff Dapur', 'code' => 'KIT', 'rank' => 35, 'sort' => 6],
                ['key' => 'cashier', 'name' => 'Kasir', 'code' => 'KSR', 'rank' => 25, 'sort' => 7],
                ['key' => 'finance_staff', 'name' => 'Staff Keuangan', 'code' => 'FIN', 'rank' => 45, 'sort' => 8],
            ],
            'job_levels' => [
                ['key' => 'director', 'name' => 'Director', 'code' => 'D', 'rank' => 100, 'sort' => 1],
                ['key' => 'manager', 'name' => 'Manager', 'code' => 'M', 'rank' => 80, 'sort' => 2],
                ['key' => 'supervisor', 'name' => 'Supervisor', 'code' => 'S', 'rank' => 60, 'sort' => 3],
                ['key' => 'staff', 'name' => 'Staff', 'code' => 'ST', 'rank' => 40, 'sort' => 4],
                ['key' => 'junior', 'name' => 'Junior', 'code' => 'J', 'rank' => 20, 'sort' => 5],
            ],
        ]);

        $employees = [
            ['email' => 'owner@demo.test', 'name' => 'Owner Demo', 'username' => 'owner', 'role' => 'owner', 'outlet' => $outlet, 'code' => 'CF-001', 'dept' => 'Manajemen', 'position' => 'Direktur', 'level' => 'Director', 'hired' => '2020-01-15', 'manager' => null],
            ['email' => 'manager@demo.test', 'name' => 'Maya Sari', 'username' => 'manager', 'role' => 'admin', 'outlet' => $outlet, 'code' => 'CF-002', 'dept' => 'Manajemen', 'position' => 'Manager Outlet', 'level' => 'Manager', 'hired' => '2021-04-01', 'manager' => 'owner@demo.test'],
            ['email' => 'chef@demo.test', 'name' => 'Rudi Hartono', 'username' => 'chef', 'role' => 'admin', 'outlet' => $outlet, 'code' => 'CF-003', 'dept' => 'Dapur', 'position' => 'Kepala Dapur', 'level' => 'Supervisor', 'hired' => '2021-07-15', 'manager' => 'manager@demo.test'],
            ['email' => 'barista1@demo.test', 'name' => 'Nadia Putri', 'username' => 'barista1', 'role' => 'cashier', 'outlet' => $outlet, 'code' => 'CF-004', 'dept' => 'Front of House', 'position' => 'Barista', 'level' => 'Staff', 'hired' => '2022-03-01', 'manager' => 'manager@demo.test'],
            ['email' => 'barista2@demo.test', 'name' => 'Reza Fadillah', 'username' => 'barista2', 'role' => 'cashier', 'outlet' => $outlet, 'code' => 'CF-005', 'dept' => 'Front of House', 'position' => 'Barista', 'level' => 'Staff', 'hired' => '2022-10-10', 'manager' => 'manager@demo.test'],
            ['email' => 'waiter1@demo.test', 'name' => 'Putri Maharani', 'username' => 'waiter1', 'role' => 'cashier', 'outlet' => $outlet, 'code' => 'CF-006', 'dept' => 'Front of House', 'position' => 'Waiter / Pramusaji', 'level' => 'Junior', 'hired' => '2023-02-14', 'manager' => 'manager@demo.test'],
            ['email' => 'waiter2@demo.test', 'name' => 'Gilang Ramadhan', 'username' => 'waiter2', 'role' => 'cashier', 'outlet' => $outlet, 'code' => 'CF-007', 'dept' => 'Front of House', 'position' => 'Waiter / Pramusaji', 'level' => 'Junior', 'hired' => '2023-08-20', 'manager' => 'manager@demo.test'],
            ['email' => 'kitchen1@demo.test', 'name' => 'Yanto Wijaya', 'username' => 'kitchen1', 'role' => 'cashier', 'outlet' => $outlet, 'code' => 'CF-008', 'dept' => 'Dapur', 'position' => 'Staff Dapur', 'level' => 'Staff', 'hired' => '2022-05-05', 'manager' => 'chef@demo.test'],
            ['email' => 'kitchen2@demo.test', 'name' => 'Imam Santoso', 'username' => 'kitchen2', 'role' => 'cashier', 'outlet' => $outlet, 'code' => 'CF-009', 'dept' => 'Dapur', 'position' => 'Staff Dapur', 'level' => 'Junior', 'hired' => '2024-01-12', 'manager' => 'chef@demo.test'],
            ['email' => 'kasir.cafe@demo.test', 'name' => 'Lestari Ayu', 'username' => 'kasircafe', 'role' => 'cashier', 'outlet' => $outlet, 'code' => 'CF-010', 'dept' => 'Front of House', 'position' => 'Kasir', 'level' => 'Staff', 'hired' => '2023-11-01', 'manager' => 'manager@demo.test'],
            ['email' => 'admin.cafe@demo.test', 'name' => 'Vina Octavia', 'username' => 'admincafe', 'role' => 'admin', 'outlet' => $outlet, 'code' => 'CF-011', 'dept' => 'Keuangan', 'position' => 'Manager Outlet', 'level' => 'Supervisor', 'hired' => '2022-01-20', 'manager' => 'manager@demo.test'],
            ['email' => 'parttime@demo.test', 'name' => 'Aulia Rahma', 'username' => 'parttime', 'role' => 'cashier', 'outlet' => $outlet, 'code' => 'CF-012', 'dept' => 'Front of House', 'position' => 'Barista', 'level' => 'Junior', 'hired' => '2024-07-01', 'manager' => 'barista1@demo.test'],
        ];

        $this->seedEmployees($company, $employees);
    }

    /**
     * @param  array{departments: list<array<string, mixed>>, positions: list<array<string, mixed>>, job_levels: list<array<string, mixed>>}  $defs
     */
    private function seedOrgMaster(Company $company, array $defs): void
    {
        $this->departments = [];
        $this->positions = [];
        $this->jobLevels = [];
        $this->members = [];

        foreach ($defs['departments'] as $row) {
            $parentId = isset($row['parent']) ? ($this->departments[$row['parent']]->id ?? null) : null;
            $dept = Department::query()->updateOrCreate(
                ['company_id' => $company->id, 'name' => $row['name']],
                [
                    'parent_id' => $parentId,
                    'code' => $row['code'] ?? null,
                    'sort_order' => $row['sort'] ?? 0,
                    'is_active' => true,
                ],
            );
            $this->departments[$row['key']] = $dept;
        }

        foreach ($defs['positions'] as $row) {
            $position = Position::query()->updateOrCreate(
                ['company_id' => $company->id, 'name' => $row['name']],
                [
                    'code' => $row['code'] ?? null,
                    'rank' => $row['rank'] ?? 0,
                    'sort_order' => $row['sort'] ?? 0,
                    'is_active' => true,
                ],
            );
            $this->positions[$row['key']] = $position;
        }

        foreach ($defs['job_levels'] as $row) {
            $level = JobLevel::query()->updateOrCreate(
                ['company_id' => $company->id, 'name' => $row['name']],
                [
                    'code' => $row['code'] ?? null,
                    'rank' => $row['rank'] ?? 0,
                    'sort_order' => $row['sort'] ?? 0,
                    'is_active' => true,
                ],
            );
            $this->jobLevels[$row['key']] = $level;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function seedEmployees(Company $company, array $rows): void
    {
        foreach ($rows as $row) {
            $user = User::query()->firstOrCreate(
                ['email' => $row['email']],
                [
                    'name' => $row['name'],
                    'username' => $row['username'] ?? null,
                    'phone' => $row['phone'] ?? $this->fakePhone($row['email']),
                    'password' => 'password',
                ],
            );

            $user->forceFill([
                'name' => $row['name'],
                'username' => $row['username'] ?? $user->username,
                ...($row['biodata'] ?? []),
            ])->save();

            $member = $this->syncMember($company, $user, $row['role'], [
                'employee_code' => $row['code'],
                'department' => $row['dept'],
                'position' => $row['position'],
                'job_level' => $row['level'],
                'hired_at' => $row['hired'],
                'manager_email' => $row['manager'] ?? null,
                'employment_status' => $row['employment_status'] ?? 'active',
                'contract_type' => $row['contract_type'] ?? null,
                'contract_end_at' => $row['contract_end_at'] ?? null,
                'terminated_at' => $row['terminated_at'] ?? null,
                'is_active' => $row['is_active'] ?? true,
                'outlet_id' => $row['outlet']->id ?? null,
            ]);

            $this->members[$row['email']] = $member;
        }
    }

    /**
     * @param  array<string, mixed>  $hr
     */
    private function syncMember(Company $company, User $user, string $roleSlug, array $hr): CompanyUser
    {
        $role = Role::query()
            ->where('scope', 'tenant')
            ->where('company_id', $company->id)
            ->where('slug', $roleSlug)
            ->first();

        $department = isset($hr['department'])
            ? Department::query()->where('company_id', $company->id)->where('name', $hr['department'])->first()
            : null;
        $position = isset($hr['position'])
            ? Position::query()->where('company_id', $company->id)->where('name', $hr['position'])->first()
            : null;
        $jobLevel = isset($hr['job_level'])
            ? JobLevel::query()->where('company_id', $company->id)->where('name', $hr['job_level'])->first()
            : null;

        $member = CompanyUser::query()->updateOrCreate(
            [
                'company_id' => $company->id,
                'user_id' => $user->id,
            ],
            [
                'outlet_id' => $hr['outlet_id'] ?? null,
                'role' => $roleSlug,
                'role_id' => $role?->id,
                'employee_code' => $hr['employee_code'] ?? null,
                'department_id' => $department?->id,
                'position_id' => $position?->id,
                'job_level_id' => $jobLevel?->id,
                'hired_at' => isset($hr['hired_at']) ? Carbon::parse($hr['hired_at']) : null,
                'employment_status' => $hr['employment_status'] ?? 'active',
                'contract_type' => $hr['contract_type'] ?? null,
                'contract_end_at' => isset($hr['contract_end_at']) ? Carbon::parse($hr['contract_end_at']) : null,
                'terminated_at' => isset($hr['terminated_at']) ? Carbon::parse($hr['terminated_at']) : null,
                'is_active' => $hr['is_active'] ?? true,
            ],
        );

        if (! empty($hr['manager_email'])) {
            $manager = CompanyUser::query()
                ->where('company_id', $company->id)
                ->whereHas('user', fn ($q) => $q->where('email', $hr['manager_email']))
                ->first();

            if ($manager && $manager->id !== $member->id) {
                $member->update(['manager_id' => $manager->id]);
            }
        } else {
            $member->update(['manager_id' => null]);
        }

        return $member->fresh();
    }

    private function fakePhone(string $email): string
    {
        $hash = abs(crc32($email));

        return '08'.str_pad((string) ($hash % 1000000000), 9, '0', STR_PAD_LEFT);
    }
}
