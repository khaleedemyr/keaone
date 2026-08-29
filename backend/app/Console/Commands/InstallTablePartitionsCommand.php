<?php

namespace App\Console\Commands;

use App\Support\HighVolumePartitionInstaller;
use App\Support\MySqlPartitions;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class InstallTablePartitionsCommand extends Command
{
    protected $signature = 'partitions:install';

    protected $description = 'Apply monthly MySQL partitions to high-volume tables';

    public function handle(): int
    {
        if (! MySqlPartitions::enabled()) {
            $driver = Schema::getConnection()->getDriverName();
            $this->error("Partitioning requires mysql/mariadb driver (current: {$driver}).");

            return self::FAILURE;
        }

        $applied = HighVolumePartitionInstaller::apply();

        if ($applied === []) {
            $this->warn('No tables were partitioned (already done or tables missing).');

            return self::SUCCESS;
        }

        foreach ($applied as $table) {
            $this->info("Partitioned: {$table}");
        }

        $this->info('Done. Run partitions:ensure to add future months.');

        return self::SUCCESS;
    }
}
