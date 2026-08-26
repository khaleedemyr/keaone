<?php

use App\Models\Company;
use App\Services\RoleService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('scope', 20);
            $table->unsignedBigInteger('company_id')->nullable();
            $table->string('name', 80);
            $table->string('slug', 80);
            $table->boolean('is_system')->default(false);
            $table->boolean('is_owner')->default(false);
            $table->timestamps();
            $table->index(['scope', 'company_id']);
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->string('menu_key', 40);
            $table->boolean('can_view')->default(false);
            $table->boolean('can_create')->default(false);
            $table->boolean('can_edit')->default(false);
            $table->boolean('can_delete')->default(false);

            $table->unique(['role_id', 'menu_key']);
        });

        Schema::table('company_user', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('role')->constrained('roles')->nullOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('platform_role_id')->nullable()->after('platform_role')->constrained('roles')->nullOnDelete();
        });

        $service = app(RoleService::class);
        $service->ensurePlatformRoles();
        $service->bindPlatformUsers();

        Company::query()->orderBy('id')->each(function (Company $company) use ($service) {
            $service->ensureTenantRoles($company);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('platform_role_id');
        });
        Schema::table('company_user', function (Blueprint $table) {
            $table->dropConstrainedForeignId('role_id');
        });
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('roles');
    }
};
