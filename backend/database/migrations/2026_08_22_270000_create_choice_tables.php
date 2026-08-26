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
        Schema::create('choice_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_required')->default(false);
            $table->unsignedTinyInteger('min_select')->default(0);
            $table->unsignedTinyInteger('max_select')->default(1);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('choices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('choice_type_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('extra_price')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('product_choices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('choice_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['product_id', 'choice_id']);
        });

        $service = app(RoleService::class);
        Company::query()->each(fn (Company $company) => $service->ensureTenantRoles($company));
    }

    public function down(): void
    {
        Schema::dropIfExists('product_choices');
        Schema::dropIfExists('choices');
        Schema::dropIfExists('choice_types');
    }
};
