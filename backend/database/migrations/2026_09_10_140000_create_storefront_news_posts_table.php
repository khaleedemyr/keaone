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
        Schema::dropIfExists('storefront_news_posts');

        Schema::create('storefront_news_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('storefront_id')->constrained('storefronts')->cascadeOnDelete();
            $table->string('slug', 160);
            $table->string('title', 200);
            $table->string('excerpt', 500)->nullable();
            $table->text('body')->nullable();
            $table->string('image_path', 255)->nullable();
            $table->string('tags', 160)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['storefront_id', 'slug'], 'sf_news_storefront_slug_uq');
            $table->index(['storefront_id', 'is_published', 'sort_order'], 'sf_news_published_sort_idx');
        });

        // Grant storefrontnews to tenant roles that already manage storefront (mirror products CRUD).
        Role::query()
            ->where('scope', 'tenant')
            ->each(function (Role $role) {
                $source = null;
                foreach (['storefrontproducts', 'storefrontpages', 'storefrontsetup', 'company', 'modules'] as $menuKey) {
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
                        'menu_key' => 'storefrontnews',
                    ],
                    [
                        'can_view' => true,
                        'can_create' => (bool) $source->can_create || (bool) $source->can_edit,
                        'can_edit' => (bool) $source->can_edit,
                        'can_delete' => (bool) $source->can_delete || (bool) $source->can_edit,
                    ],
                );
            });
    }

    public function down(): void
    {
        RolePermission::query()->where('menu_key', 'storefrontnews')->delete();
        Schema::dropIfExists('storefront_news_posts');
    }
};
