<?php

use App\Models\Role;
use App\Models\RolePermission;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storefront_inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('storefront_id')->constrained('storefronts')->cascadeOnDelete();
            $table->string('kind', 20)->default('contact');
            $table->string('name', 120);
            $table->string('email', 120);
            $table->string('phone', 40)->nullable();
            $table->string('subject', 200)->nullable();
            $table->text('message');
            $table->json('meta')->nullable();
            $table->string('status', 20)->default('new');
            $table->timestamp('read_at')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamps();

            $table->index(['storefront_id', 'status', 'created_at'], 'sf_inq_storefront_status_created_idx');
            $table->index(['storefront_id', 'kind'], 'sf_inq_storefront_kind_idx');
        });

        Role::query()
            ->where('scope', 'tenant')
            ->each(function (Role $role) {
                $source = null;
                foreach (['storefrontsetup', 'storefrontnews', 'storefrontproducts', 'storefrontpages', 'company', 'modules'] as $menuKey) {
                    $candidate = RolePermission::query()
                        ->where('role_id', $role->id)
                        ->where('menu_key', $menuKey)
                        ->first();
                    if ($candidate && $candidate->can_view) {
                        $source = $candidate;
                        break;
                    }
                }

                if (! $source) {
                    return;
                }

                RolePermission::query()->updateOrCreate(
                    [
                        'role_id' => $role->id,
                        'menu_key' => 'storefrontinquiries',
                    ],
                    [
                        'can_view' => true,
                        'can_create' => false,
                        'can_edit' => (bool) $source->can_edit,
                        'can_delete' => (bool) $source->can_delete || (bool) $source->can_edit,
                    ],
                );
            });
    }

    public function down(): void
    {
        RolePermission::query()->where('menu_key', 'storefrontinquiries')->delete();
        Schema::dropIfExists('storefront_inquiries');
    }
};
