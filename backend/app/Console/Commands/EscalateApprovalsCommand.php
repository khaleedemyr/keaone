<?php

namespace App\Console\Commands;

use App\Services\ApprovalGovernanceService;
use Illuminate\Console\Command;

class EscalateApprovalsCommand extends Command
{
    protected $signature = 'procurement:escalate-approvals';

    protected $description = 'Escalate stale procurement approval steps past SLA';

    public function handle(ApprovalGovernanceService $governance): int
    {
        $count = $governance->escalateStaleApprovals();
        $this->info("Escalated {$count} approval step(s).");

        return self::SUCCESS;
    }
}
