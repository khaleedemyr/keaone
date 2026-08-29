<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Support\MySqlPartitions;
use Illuminate\Console\Command;

class PruneActivityLogsCommand extends Command
{
    protected $signature = 'activity-logs:prune {--days= : Retention days (default from config)}';

    protected $description = 'Prune activity logs older than the retention window';

    public function handle(): int
    {
        $days = max(1, (int) ($this->option('days') ?: config('partitions.retention_days.activity_logs', 90)));
        $cutoff = now()->subDays($days)->startOfDay();

        if (MySqlPartitions::isPartitioned('activity_logs')) {
            $dropped = MySqlPartitions::dropPartitionsBefore('activity_logs', $cutoff);
            $this->info("Dropped {$dropped} activity_log partition(s) older than {$days} days.");

            return self::SUCCESS;
        }

        $deleted = 0;
        do {
            $batch = ActivityLog::query()
                ->where('created_at', '<', $cutoff)
                ->orderBy('id')
                ->limit(1000)
                ->delete();
            $deleted += $batch;
        } while ($batch > 0);

        $this->info("Deleted {$deleted} activity log rows older than {$days} days.");

        return self::SUCCESS;
    }
}
