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
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('scope', 20)->default('tenant');
            $table->string('action', 40);
            $table->string('menu_key', 40)->nullable();
            $table->string('summary', 255);
            $table->string('target', 120)->nullable();
            $table->string('method', 10)->nullable();
            $table->string('path', 180)->nullable();
            $table->unsignedSmallInteger('status')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'id']);
            $table->index(['user_id', 'id']);
            $table->index(['scope', 'id']);
            $table->index(['menu_key', 'id']);
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->foreign('company_id')->references('id')->on('companies')->nullOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
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
        Schema::dropIfExists('activity_logs');
    }
};
