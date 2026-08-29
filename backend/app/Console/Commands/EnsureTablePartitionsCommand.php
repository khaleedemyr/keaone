<?php

namespace App\Console\Commands;

use App\Support\MySqlPartitions;
use Carbon\Carbon;
use Illuminate\Console\Command;

class EnsureTablePartitionsCommand extends Command
{
    protected $signature = 'partitions:ensure {--months=3 : Ensure partitions exist this many months ahead}';

    protected $description = 'Create upcoming monthly MySQL partitions for high-volume tables';

    public function handle(): int
    {
        if (! MySqlPartitions::enabled()) {
            $this->warn('Partitioning requires mysql/mariadb — skipped.');

            return self::SUCCESS;
        }

        $months = max(1, (int) $this->option('months'));
        $added = 0;

        foreach (array_keys(config('partitions.tables', [])) as $table) {
            if (! MySqlPartitions::isPartitioned($table)) {
                $this->line("Skip {$table} (not partitioned yet — run migrate).");

                continue;
            }

            for ($i = 0; $i <= $months; $i++) {
                $month = Carbon::now()->addMonths($i)->startOfMonth();
                if (MySqlPartitions::ensureMonthPartition($table, $month)) {
                    $added++;
                    $this->info("Added partition p{$month->format('Ym')} on {$table}");
                }
            }
        }

        $this->info("Done. {$added} new partition(s).");

        return self::SUCCESS;
    }
}
