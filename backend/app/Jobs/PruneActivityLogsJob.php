<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Artisan;

class PruneActivityLogsJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $days = 90) {}

    public function handle(): void
    {
        Artisan::call('activity-logs:prune', ['--days' => (string) $this->days]);
    }
}
