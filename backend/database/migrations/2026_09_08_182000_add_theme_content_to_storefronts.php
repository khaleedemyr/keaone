<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('storefronts')) {
            return;
        }

        Schema::table('storefronts', function (Blueprint $table) {
            if (! Schema::hasColumn('storefronts', 'theme_content')) {
                $table->json('theme_content')->nullable()->after('brand_colors');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('storefronts')) {
            return;
        }

        Schema::table('storefronts', function (Blueprint $table) {
            if (Schema::hasColumn('storefronts', 'theme_content')) {
                $table->dropColumn('theme_content');
            }
        });
    }
};
