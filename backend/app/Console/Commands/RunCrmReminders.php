<?php

namespace App\Console\Commands;

use App\Services\CrmAutomations;
use Illuminate\Console\Command;

class RunCrmReminders extends Command
{
    protected $signature = 'team:crm-reminders';

    protected $description = 'Create authorized CRM reminders and run idempotent inactivity rules';

    public function handle(CrmAutomations $automations): int
    {
        $this->info(json_encode(['processed' => $automations->run()]));

        return self::SUCCESS;
    }
}
