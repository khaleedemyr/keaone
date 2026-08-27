<?php

use App\Services\RoleService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Grant platform menu `livesupport` to existing platform roles.
        app(RoleService::class)->ensurePlatformRoles();
    }

    public function down(): void
    {
        //
    }
};
