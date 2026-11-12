<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CrmAutomations
{
    public function __construct(private CrmRecords $records) {}

    public function changed(string $board, array $record, array $previous): void
    {
        if (! in_array($record['kind'], ['deal', 'offer'], true)) {
            return;
        }
        foreach ($this->records->rows($board) as $row) {
            if ($row->kind !== 'rule') {
                continue;
            }
            $rule = $this->records->data($row);
            if (! $rule['enabled']) {
                continue;
            }
            $data = $record['data'];
            $match = ($rule['trigger'] === 'offer_sent' && $record['kind'] === 'offer' && $data['status'] === 'sent' && ($previous['status'] ?? null) !== 'sent')
                || ($rule['trigger'] === 'stage_changed' && $record['kind'] === 'deal' && $data['stageId'] === ($rule['stageId'] ?? '') && ($previous['stageId'] ?? null) !== $data['stageId']);
            if ($match) {
                $this->execute($board, $record, $rule, $row->id.':'.$record['id'].':'.$record['revision']);
            }
        }
    }

    public function run(): int
    {
        $processed = 0;
        foreach (DB::table('boards')->pluck('id') as $board) {
            $processed += DB::transaction(function () use ($board): int {
                DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
                $rows = $this->records->rows($board);
                $rules = [];
                $lastActivity = [];
                foreach ($rows as $row) {
                    $data = $this->records->data($row);
                    if ($row->kind === 'rule' && $data['enabled'] && $data['trigger'] === 'inactive') {
                        $rules[$row->id] = $data;
                    }
                    if ($row->kind === 'activity' && $row->parent_id) {
                        $stamp = $data['occurredAt'] ?? $row->created_at;
                        $parent = $row->parent_id;
                        for ($depth = 0; $parent && isset($rows[$parent]) && $depth < 12; $depth++) {
                            if (! isset($lastActivity[$parent]) || Carbon::parse($stamp)->gt(Carbon::parse($lastActivity[$parent]))) {
                                $lastActivity[$parent] = $stamp;
                            }
                            $parent = $rows[$parent]->parent_id;
                        }
                    }
                }
                $count = 0;
                foreach ($rows as $row) {
                    $record = $this->records->present($row);
                    $data = $record['data'];
                    $due = match ($row->kind) {
                        'followup' => $data['status'] === 'open' ? ($data['dueAt'] ?? null) : null,
                        'event' => $data['startsAt'],
                        'service' => $data['status'] !== 'closed' ? ($data['dueAt'] ?? $data['nextInspectionDate'] ?? null) : null,
                        default => null,
                    };
                    if ($due && Carbon::parse($due)->subMinutes($data['reminderMinutes'] ?? 30)->lte(now())) {
                        $target = $data['assigneeId'] ?? $row->owner_id;
                        $count += $this->notice($board, $record, $target, 'Termin: '.$data['title'], 'due:'.$row->id.':'.$due.':'.$target) ? 1 : 0;
                    }
                    if (in_array($row->kind, ['company', 'project', 'deal'], true)) {
                        $stamp = $lastActivity[$row->id] ?? $row->created_at;
                        foreach ($rules as $ruleId => $rule) {
                            if (Carbon::parse($stamp)->addDays($rule['days'])->lte(now())) {
                                $count += $this->execute($board, $record, $rule, $ruleId.':'.$row->id.':'.$stamp) ? 1 : 0;
                            }
                        }
                    }
                }

                return $count;
            });
        }

        return $processed;
    }

    private function target(string $board, array $record, string $id): ?User
    {
        $user = User::query()->where('id', $id)->where('active', true)->first();
        $member = DB::table('memberships')->where('board_id', $board)->where('user_id', $id)->first();
        $rows = $this->records->rows($board);

        return $user && $member && isset($rows[$record['id']]) && $this->records->canRead($rows[$record['id']], $user, $member, $rows) ? $user : null;
    }

    private function claim(string $board, string $key): bool
    {
        return DB::table('crm_automation_runs')->insertOrIgnore(['id' => hash('sha256', $board.':'.$key), 'board_id' => $board, 'created_at' => now()]) === 1;
    }

    private function execute(string $board, array $record, array $rule, string $key): bool
    {
        return DB::transaction(function () use ($board, $record, $rule, $key): bool {
            $target = $rule['assigneeId'] ?? $record['ownerId'];
            $user = $this->target($board, $record, $target);
            if (! $user || ! $this->claim($board, $key)) {
                return false;
            }
            if ($rule['action'] === 'followup') {
                $this->records->save($board, $user, ['kind' => 'followup', 'parentId' => $record['id'], 'ownerId' => $user->id,
                    'visibility' => 'team', 'accessIds' => [], 'revision' => 0, 'data' => ['title' => $rule['title'], 'type' => $rule['taskType'], 'status' => 'open',
                        'dueAt' => now()->addDays($rule['delayDays'])->format('Y-m-d\TH:i:sP'), 'assigneeId' => $user->id, 'priority' => 'medium', 'reminderMinutes' => 30]]);
            }
            DB::table('crm_notifications')->insert(['id' => (string) Str::uuid(), 'board_id' => $board, 'record_id' => $record['id'], 'user_id' => $user->id,
                'ciphertext' => Crypt::encryptString($rule['title'].' · '.$record['data']['title']), 'created_at' => now()]);

            return true;
        });
    }

    private function notice(string $board, array $record, string $target, string $message, string $key): bool
    {
        if (! $this->target($board, $record, $target) || ! $this->claim($board, $key)) {
            return false;
        }
        DB::table('crm_notifications')->insert(['id' => (string) Str::uuid(), 'board_id' => $board, 'record_id' => $record['id'], 'user_id' => $target,
            'ciphertext' => Crypt::encryptString($message), 'created_at' => now()]);

        return true;
    }
}
