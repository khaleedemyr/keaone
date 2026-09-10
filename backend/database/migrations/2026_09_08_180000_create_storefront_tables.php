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
        if (! Schema::hasTable('storefronts')) {
            Schema::create('storefronts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('outlet_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('warehouse_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('price_channel_id')->nullable()->constrained()->nullOnDelete();
                $table->string('site_kind', 20)->default('landing');
                $table->string('template_key', 60)->default('landing_minimal');
                $table->string('status', 20)->default('draft');
                $table->string('title')->nullable();
                $table->string('tagline')->nullable();
                $table->text('about')->nullable();
                $table->string('logo_path')->nullable();
                $table->json('brand_colors')->nullable();
                $table->json('bank_accounts')->nullable();
                $table->string('stock_mode', 20)->default('realtime');
                $table->string('contact_email')->nullable();
                $table->string('contact_phone')->nullable();
                $table->text('contact_address')->nullable();
                $table->string('seo_title')->nullable();
                $table->text('seo_description')->nullable();
                $table->timestamp('published_at')->nullable();
                $table->timestamps();

                $table->unique('company_id');
                $table->index(['status', 'site_kind']);
            });
        }

        if (! Schema::hasTable('storefront_domains')) {
            Schema::create('storefront_domains', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('storefront_id')->constrained()->cascadeOnDelete();
                $table->string('host')->unique();
                $table->string('status', 20)->default('pending_dns');
                $table->string('acquisition', 20)->default('connect');
                $table->string('registrar_ref')->nullable();
                $table->json('dns_instructions')->nullable();
                $table->string('ssl_status', 20)->default('pending');
                $table->boolean('is_primary')->default(true);
                $table->timestamp('verified_at')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'status']);
                $table->index(['storefront_id', 'is_primary']);
            });
        }

        if (! Schema::hasTable('storefront_pages')) {
            Schema::create('storefront_pages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('storefront_id')->constrained()->cascadeOnDelete();
                $table->string('slug', 80);
                $table->string('title');
                $table->string('kind', 30)->default('custom');
                $table->json('content')->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->boolean('is_published')->default(true);
                $table->timestamps();

                $table->unique(['storefront_id', 'slug']);
                $table->index(['storefront_id', 'sort_order']);
            });
        }

        if (! Schema::hasTable('storefront_products')) {
            Schema::create('storefront_products', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('storefront_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->boolean('is_visible')->default(true);
                $table->unsignedInteger('sort_order')->default(0);
                $table->unsignedInteger('allocated_qty')->nullable();
                $table->unsignedInteger('sold_qty')->default(0);
                $table->unsignedBigInteger('override_price')->nullable();
                $table->timestamps();

                $table->unique(['storefront_id', 'product_id']);
                $table->index(['storefront_id', 'is_visible', 'sort_order']);
            });
        }

        if (! Schema::hasTable('storefront_orders')) {
            Schema::create('storefront_orders', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('storefront_id')->constrained()->cascadeOnDelete();
                // No FK — sales is partitioned (MySQL error 1506).
                $table->unsignedBigInteger('sale_id')->nullable()->index();
                $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
                $table->string('number');
                $table->uuid('client_uuid');
                $table->string('status', 30)->default('pending_payment');
                $table->string('customer_name');
                $table->string('customer_phone')->nullable();
                $table->string('customer_email')->nullable();
                $table->text('customer_address')->nullable();
                $table->unsignedBigInteger('subtotal')->default(0);
                $table->unsignedBigInteger('discount')->default(0);
                $table->unsignedBigInteger('tax')->default(0);
                $table->unsignedBigInteger('total')->default(0);
                $table->string('payment_method', 30)->default('bank_transfer');
                $table->text('payment_note')->nullable();
                $table->string('transfer_proof_path')->nullable();
                $table->json('bank_snapshot')->nullable();
                $table->text('note')->nullable();
                $table->timestamp('placed_at')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->timestamp('cancelled_at')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'number']);
                $table->unique(['company_id', 'client_uuid']);
                $table->index(['storefront_id', 'status', 'placed_at']);
            });
        }

        if (! Schema::hasTable('storefront_order_items')) {
            Schema::create('storefront_order_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('storefront_order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->string('name_snapshot');
                $table->unsignedInteger('qty');
                $table->unsignedBigInteger('unit_price')->default(0);
                $table->unsignedBigInteger('line_total')->default(0);
                $table->timestamps();

                $table->index(['storefront_order_id', 'product_id']);
            });
        }

        $menus = [
            'storefrontsetup' => ['view' => true, 'create' => false, 'edit' => true, 'delete' => false],
            'storefrontdomain' => ['view' => true, 'create' => true, 'edit' => true, 'delete' => true],
            'storefrontproducts' => ['view' => true, 'create' => true, 'edit' => true, 'delete' => true],
            'storefrontorders' => ['view' => true, 'create' => false, 'edit' => true, 'delete' => false],
            'storefrontpages' => ['view' => true, 'create' => true, 'edit' => true, 'delete' => true],
        ];

        Role::query()
            ->where('scope', 'tenant')
            ->each(function (Role $role) use ($menus) {
                $source = null;
                foreach (['company', 'modules', 'settings', 'products'] as $menuKey) {
                    $source = RolePermission::query()
                        ->where('role_id', $role->id)
                        ->where('menu_key', $menuKey)
                        ->first();
                    if ($source) {
                        break;
                    }
                }

                if (! $source || ! $source->can_view) {
                    return;
                }

                foreach ($menus as $menuKey => $actions) {
                    RolePermission::query()->updateOrCreate(
                        [
                            'role_id' => $role->id,
                            'menu_key' => $menuKey,
                        ],
                        [
                            'can_view' => $actions['view'] && (bool) $source->can_view,
                            'can_create' => $actions['create'] && (bool) $source->can_create,
                            'can_edit' => $actions['edit'] && (bool) $source->can_edit,
                            'can_delete' => $actions['delete'] && (bool) $source->can_delete,
                        ],
                    );
                }
            });
    }

    public function down(): void
    {
        RolePermission::query()
            ->whereIn('menu_key', [
                'storefrontsetup',
                'storefrontdomain',
                'storefrontproducts',
                'storefrontorders',
                'storefrontpages',
            ])
            ->delete();

        Schema::dropIfExists('storefront_order_items');
        Schema::dropIfExists('storefront_orders');
        Schema::dropIfExists('storefront_products');
        Schema::dropIfExists('storefront_pages');
        Schema::dropIfExists('storefront_domains');
        Schema::dropIfExists('storefronts');
    }
};
