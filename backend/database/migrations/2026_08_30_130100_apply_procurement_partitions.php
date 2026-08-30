<?php

use App\Support\HighVolumePartitionInstaller;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        HighVolumePartitionInstaller::apply();
    }

    public function down(): void
    {
        // Partition removal is manual on production.
    }
};
