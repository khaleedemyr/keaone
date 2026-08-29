<?php

namespace App\Console\Commands;

use App\Models\Message;
use App\Support\MySqlPartitions;
use Illuminate\Console\Command;

class PruneChatMessagesCommand extends Command
{
    protected $signature = 'chat:prune {--days= : Retention days (default from config)}';

    protected $description = 'Prune chat messages older than the retention window';

    public function handle(): int
    {
        if (! class_exists(Message::class)) {
            return self::SUCCESS;
        }

        $days = max(1, (int) ($this->option('days') ?: config('partitions.retention_days.messages', 365)));
        $cutoff = now()->subDays($days)->startOfDay();

        if (MySqlPartitions::isPartitioned('messages')) {
            $dropped = MySqlPartitions::dropPartitionsBefore('messages', $cutoff);
            $this->info("Dropped {$dropped} message partition(s) older than {$days} days.");

            return self::SUCCESS;
        }

        $deleted = 0;
        do {
            $batch = Message::query()
                ->where('created_at', '<', $cutoff)
                ->orderBy('id')
                ->limit(1000)
                ->delete();
            $deleted += $batch;
        } while ($batch > 0);

        $this->info("Deleted {$deleted} chat message rows older than {$days} days.");

        return self::SUCCESS;
    }
}
