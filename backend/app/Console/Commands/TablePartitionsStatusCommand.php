<?php

namespace App\Console\Commands;

use App\Support\MySqlPartitions;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TablePartitionsStatusCommand extends Command
{
    protected $signature = 'partitions:status';

    protected $description = 'Show database driver and partition status for high-volume tables';

    public function handle(): int
    {
        $connection = Schema::getConnection();
        $driver = $connection->getDriverName();
        $database = $connection->getDatabaseName();

        $this->info("Connection: {$driver} / {$database}");
        $this->info('Partitioning enabled: '.(MySqlPartitions::enabled() ? 'yes' : 'no'));

        if (! MySqlPartitions::enabled()) {
            return self::SUCCESS;
        }

        $supports = null;
        try {
            $supports = DB::selectOne('SELECT @@have_partitioning AS supported');
        } catch (\Throwable) {
            // MariaDB 10.5+ removed @@have_partitioning (always available).
        }

        if ($supports !== null) {
            $supported = strtoupper((string) ($supports->supported ?? 'NO')) === 'YES';
            $this->info('Server @@have_partitioning: '.($supported ? 'YES' : 'NO'));
        }

        $rows = [
            ['Table', 'Exists', 'Partitioned', 'Partitions'],
        ];

        foreach (array_keys(config('partitions.tables', [])) as $table) {
            $exists = Schema::hasTable($table);
            $partitioned = $exists && MySqlPartitions::isPartitioned($table);
            $count = $partitioned ? count(MySqlPartitions::partitionNames($table)) : 0;

            $rows[] = [
                $table,
                $exists ? 'yes' : 'no',
                $partitioned ? 'yes' : 'no',
                $partitioned ? (string) $count : '-',
            ];
        }

        $this->table($rows[0], array_slice($rows, 1));

        return self::SUCCESS;
    }
}
