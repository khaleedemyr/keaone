<?php

namespace App\Console\Commands;

use App\Models\UserNotification;
use App\Support\MySqlPartitions;
use Illuminate\Console\Command;

class PruneUserNotificationsCommand extends Command
{
    protected $signature = 'notifications:prune {--days= : Retention days (default from config)}';

    protected $description = 'Prune user notifications older than the retention window';

    public function handle(): int
    {
        $days = max(1, (int) ($this->option('days') ?: config('partitions.retention_days.user_notifications', 90)));
        $cutoff = now()->subDays($days)->startOfDay();

        if (MySqlPartitions::isPartitioned('user_notifications')) {
            $dropped = MySqlPartitions::dropPartitionsBefore('user_notifications', $cutoff);
            $this->info("Dropped {$dropped} notification partition(s) older than {$days} days.");

            return self::SUCCESS;
        }

        $deleted = 0;
        do {
            $batch = UserNotification::query()
                ->where('created_at', '<', $cutoff)
                ->orderBy('id')
                ->limit(1000)
                ->delete();
            $deleted += $batch;
        } while ($batch > 0);

        $this->info("Deleted {$deleted} notification rows older than {$days} days.");

        return self::SUCCESS;
    }
}
