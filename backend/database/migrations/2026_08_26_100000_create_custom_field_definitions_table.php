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
        Schema::create('custom_field_definitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('entity', 32);
            $table->string('key', 64);
            $table->string('label', 120);
            $table->string('type', 20);
            $table->json('options')->nullable();
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['company_id', 'entity', 'key']);
            $table->index(['company_id', 'entity', 'is_active', 'sort_order'], 'custom_fields_entity_active_idx');
        });

        $service = app(RoleService::class);
        Company::query()->each(fn (Company $company) => $service->ensureTenantRoles($company));
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_field_definitions');
    }
};
