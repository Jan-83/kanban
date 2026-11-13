<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CrmRecords
{
    public function __construct(private CrmSchema $schema, private BoardDocuments $documents) {}

    public function membership(string $board, User $user): object
    {
        $member = DB::table('memberships')->where('board_id', $board)->where('user_id', $user->id)->first();
        abort_unless($user->active && $member, 404);

        return $member;
    }

    public function rows(string $board): array
    {
        return DB::table('crm_records')->where('board_id', $board)->whereNull('deleted_at')->orderByDesc('updated_at')->orderBy('id')->get()->keyBy('id')->all();
    }

    public function canRead(object $row, User $user, object $membership, array $rows, array $seen = []): bool
    {
        if ($row->board_id !== $membership->board_id || $row->deleted_at !== null || isset($seen[$row->id]) || count($seen) >= 12) {
            return false;
        }
        if ($row->kind === 'rule' && $membership->role !== 'admin') {
            return false;
        }
        if ($membership->role !== 'admin' && $row->visibility === 'restricted' && $row->owner_id !== $user->id
            && ! in_array($user->id, json_decode($row->access_ids, true), true)) {
            return false;
        }
        $seen[$row->id] = true;

        return $row->parent_id === null || (isset($rows[$row->parent_id]) && $this->canRead($rows[$row->parent_id], $user, $membership, $rows, $seen));
    }

    public function accessible(string $board, string $id, User $user): object
    {
        $member = $this->membership($board, $user);
        $rows = $this->rows($board);
        $row = $rows[$id] ?? null;
        abort_unless($row && $this->canRead($row, $user, $member, $rows), 404);

        return $row;
    }

    public function data(object $row): array
    {
        return json_decode(Crypt::decryptString($row->ciphertext), true, 512, JSON_THROW_ON_ERROR);
    }

    public function present(object $row): array
    {
        return ['id' => $row->id, 'kind' => $row->kind, 'parentId' => $row->parent_id, 'ownerId' => $row->owner_id,
            'visibility' => $row->visibility, 'accessIds' => json_decode($row->access_ids, true), 'revision' => (int) $row->revision,
            'data' => $this->data($row), 'createdAt' => $row->created_at, 'updatedAt' => $row->updated_at];
    }

    public function settings(string $board): array
    {
        $row = DB::table('crm_settings')->where('board_id', $board)->first();

        return ['revision' => (int) ($row->revision ?? 0), 'data' => array_replace($this->schema->defaults(), $row ? $this->data($row) : [])];
    }

    public function bootstrap(string $board, User $user): array
    {
        $member = $this->membership($board, $user);
        $rows = $this->rows($board);
        $visible = array_filter($rows, fn ($row) => $this->canRead($row, $user, $member, $rows));
        $notifications = DB::table('crm_notifications')->where('board_id', $board)->where('user_id', $user->id)->orderByDesc('created_at')->limit(100)->get()
            ->filter(fn ($row) => isset($visible[$row->record_id]))->map(fn ($row) => ['id' => $row->id, 'recordId' => $row->record_id,
                'message' => Crypt::decryptString($row->ciphertext), 'read' => $row->read_at !== null, 'createdAt' => $row->created_at])->values()->all();

        return ['records' => array_values(array_map(fn ($row) => $this->present($row), $visible)), 'settings' => $this->settings($board),
            'members' => DB::table('memberships')->join('users', 'users.id', '=', 'memberships.user_id')->where('board_id', $board)->where('users.active', true)
                ->select('users.id', 'memberships.display_name as name', 'memberships.role')->orderBy('name')->get()->all(),
            'notifications' => $notifications, 'role' => $member->role, 'serverTime' => now()->toISOString(), 'preview' => app()->environment('local')];
    }

    public function save(string $board, User $user, array $input, ?string $id = null): array
    {
        $this->schema->keys($input, ['kind', 'parentId', 'ownerId', 'visibility', 'accessIds', 'revision', 'data']);
        $input = Validator::make($input, ['kind' => ['required', 'in:'.implode(',', CrmSchema::KINDS)], 'parentId' => ['present', 'nullable', 'uuid'],
            'ownerId' => ['required', 'uuid'], 'visibility' => ['required', 'in:team,restricted'], 'accessIds' => ['present', 'array', 'list', 'max:200'],
            'accessIds.*' => ['required', 'uuid', 'distinct'], 'revision' => ['required', 'integer:strict', 'between:0,2147483646'], 'data' => ['required', 'array']])->validate();

        return DB::transaction(function () use ($board, $user, $input, $id): array {
            DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
            $member = $this->membership($board, $user);
            $rows = $this->rows($board);
            $old = $id ? ($rows[$id] ?? null) : null;
            abort_if($id && (! $old || ! $this->canRead($old, $user, $member, $rows)), 404);
            abort_unless(($old ? (int) $old->revision : 0) === $input['revision'], 409, 'Rekord zmieniła inna osoba. Odśwież go przed zapisem.');
            abort_if($old && $input['kind'] !== $old->kind, 422);
            abort_if($input['kind'] === 'rule' && $member->role !== 'admin', 403, 'Regułami zarządza administrator.');
            $members = DB::table('memberships')->join('users', 'users.id', '=', 'memberships.user_id')->where('board_id', $board)->where('users.active', true)->pluck('users.id')->all();
            abort_unless(in_array($input['ownerId'], $members, true) && array_diff($input['accessIds'], $members) === [], 422, 'Wybierz aktywnych członków zespołu.');
            if ($member->role !== 'admin') {
                if (! $old) {
                    abort_unless($input['ownerId'] === $user->id, 403, 'Rekord utworzy jego opiekun.');
                } elseif ($old->owner_id !== $user->id) {
                    abort_unless($input['ownerId'] === $old->owner_id && $input['visibility'] === $old->visibility
                        && $input['accessIds'] === json_decode($old->access_ids, true) && $input['parentId'] === $old->parent_id, 403, 'Dostęp zmienia opiekun lub administrator.');
                }
            }
            $id ??= (string) Str::uuid();
            if ($input['parentId']) {
                $parent = $rows[$input['parentId']] ?? null;
                abort_unless($parent && $this->canRead($parent, $user, $member, $rows)
                    && in_array($parent->kind, ['company', 'contact', 'designer', 'project', 'deal', 'offer', 'service'], true), 422, 'Nieprawidłowe powiązanie.');
                $cursor = $parent;
                $depth = 0;
                while ($cursor) {
                    abort_if($cursor->id === $id || ++$depth >= 10, 422, 'Powiązania nie mogą tworzyć pętli.');
                    $cursor = $cursor->parent_id ? ($rows[$cursor->parent_id] ?? null) : null;
                }
            }
            $data = $this->schema->payload($input['kind'], $input['data'], $this->settings($board)['data']);
            abort_if(isset($data['assigneeId']) && ! in_array($data['assigneeId'], $members, true), 422, 'Wybierz aktywnego członka zespołu.');
            foreach ($data['relationships'] ?? [] as $relation) {
                $related = $rows[$relation['recordId']] ?? null;
                abort_unless($related && $this->canRead($related, $user, $member, $rows) && in_array($related->kind, ['company', 'contact', 'designer'], true), 422, 'Nieprawidłowy uczestnik inwestycji.');
            }
            $oldData = $old ? $this->data($old) : [];
            foreach (['kanbanTaskId', 'version', 'seriesId', 'sentAt'] as $serverField) {
                if (isset($oldData[$serverField])) {
                    $data[$serverField] = $oldData[$serverField];
                }
            }
            if ($input['kind'] === 'offer') {
                $data['version'] ??= 1;
                $data['seriesId'] ??= $id;
                if ($data['status'] === 'sent' && ($oldData['status'] ?? '') !== 'sent') {
                    $data['sentAt'] = now()->toISOString();
                }
            }
            $values = ['board_id' => $board, 'kind' => $input['kind'], 'parent_id' => $input['parentId'], 'owner_id' => $input['ownerId'],
                'visibility' => $input['visibility'], 'access_ids' => json_encode($input['accessIds'], JSON_THROW_ON_ERROR),
                'revision' => $input['revision'] + 1, 'ciphertext' => Crypt::encryptString(json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)),
                'updated_by' => $user->id, 'updated_at' => now()];
            if ($old) {
                $this->history($old, $user->id);
                DB::table('crm_records')->where('id', $id)->update($values);
            } else {
                abort_if(count($rows) >= 10000, 422, 'Osiągnięto limit 10 000 aktywnych rekordów.');
                DB::table('crm_records')->insert($values + ['id' => $id, 'created_by' => $user->id, 'created_at' => now()]);
            }

            return $this->present(DB::table('crm_records')->where('id', $id)->first());
        });
    }

    public function history(object $row, string $actor): void
    {
        DB::table('crm_versions')->insert(['record_id' => $row->id, 'revision' => $row->revision,
            'ciphertext' => Crypt::encryptString(json_encode($this->present($row), JSON_THROW_ON_ERROR)), 'actor_id' => $actor, 'created_at' => now()]);
    }

    public function details(string $board, string $id, User $user): array
    {
        $row = $this->accessible($board, $id, $user);
        $versions = DB::table('crm_versions')->where('record_id', $id)->orderByDesc('revision')->limit(60)->get()
            ->map(fn ($version) => ['revision' => (int) $version->revision, 'actorId' => $version->actor_id, 'createdAt' => $version->created_at])->all();
        $files = DB::table('crm_files')->where('record_id', $id)->whereNull('deleted_at')->orderByDesc('created_at')->get()
            ->map(fn ($file) => ['id' => $file->id, 'name' => Crypt::decryptString($file->name), 'mime' => $file->mime, 'bytes' => (int) $file->bytes, 'createdAt' => $file->created_at])->all();

        return ['record' => $this->present($row), 'history' => $versions, 'files' => $files];
    }

    public function archive(string $board, string $id, User $user, int $revision): void
    {
        DB::transaction(function () use ($board, $id, $user, $revision): void {
            DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
            $row = $this->accessible($board, $id, $user);
            abort_unless($row->owner_id === $user->id || $this->membership($board, $user)->role === 'admin', 403, 'Archiwizuje opiekun lub administrator.');
            abort_unless((int) $row->revision === $revision, 409);
            $this->history($row, $user->id);
            DB::table('crm_records')->where('id', $id)->update(['deleted_at' => now(), 'updated_at' => now(), 'updated_by' => $user->id, 'revision' => $revision + 1]);
        });
    }

    public function saveSettings(string $board, User $user, array $data, int $revision): array
    {
        abort_unless($this->membership($board, $user)->role === 'admin', 403, 'Ustawienia zmienia administrator.');

        return DB::transaction(function () use ($board, $data, $revision): array {
            DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
            abort_unless($this->settings($board)['revision'] === $revision, 409);
            $data = $this->schema->settings(array_replace($this->settings($board)['data'], $data));
            foreach (DB::table('crm_records')->where('board_id', $board)->where('kind', 'designer')->whereNull('deleted_at')->cursor() as $designer) {
                $profile = $this->data($designer);
                abort_unless(in_array($profile['categoryId'], array_column($data['designerCategories'], 'id'), true), 422, 'Najpierw przenieś projektantów z usuwanej kategorii.');
                abort_if(! empty($profile['strategyId']) && ! in_array($profile['strategyId'], array_column($data['designerStrategies'], 'id'), true), 422, 'Najpierw zmień strategię przypisaną do projektantów.');
            }
            foreach (DB::table('crm_records')->where('board_id', $board)->where('kind', 'deal')->whereNull('deleted_at')->cursor() as $deal) {
                abort_unless(in_array($this->data($deal)['stageId'], array_column($data['stages'], 'id'), true), 422, 'Najpierw przenieś szanse z usuwanego etapu.');
            }
            foreach (DB::table('crm_records')->where('board_id', $board)->where('kind', 'rule')->whereNull('deleted_at')->cursor() as $rule) {
                $ruleData = $this->data($rule);
                abort_if($ruleData['trigger'] === 'stage_changed' && ! in_array($ruleData['stageId'], array_column($data['stages'], 'id'), true), 422, 'Najpierw zmień regułę korzystającą z usuwanego etapu.');
            }
            DB::table('crm_settings')->updateOrInsert(['board_id' => $board], ['revision' => $revision + 1,
                'ciphertext' => Crypt::encryptString(json_encode($data, JSON_THROW_ON_ERROR)), 'updated_at' => now()]);

            return $this->settings($board);
        });
    }

    public function version(string $board, string $id, User $user, int $revision): array
    {
        return DB::transaction(function () use ($board, $id, $user, $revision): array {
            DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
            $row = $this->accessible($board, $id, $user);
            abort_unless($row->kind === 'offer' && (int) $row->revision === $revision, 409);
            $data = $this->data($row);
            $highest = 0;
            foreach (DB::table('crm_records')->where('board_id', $board)->where('kind', 'offer')->cursor() as $offer) {
                $other = $this->data($offer);
                if ($other['seriesId'] === $data['seriesId']) {
                    $highest = max($highest, $other['version']);
                }
            }
            $data['version'] = $highest + 1;
            $data['status'] = 'draft';
            unset($data['sentAt']);
            $this->history($row, $user->id);
            DB::table('crm_records')->where('id', $id)->update(['revision' => $revision + 1, 'updated_at' => now(), 'updated_by' => $user->id]);
            $newId = (string) Str::uuid();
            DB::table('crm_records')->insert(['id' => $newId, 'board_id' => $board, 'kind' => 'offer', 'parent_id' => $row->parent_id,
                'owner_id' => $row->owner_id, 'visibility' => $row->visibility, 'access_ids' => $row->access_ids, 'revision' => 1,
                'ciphertext' => Crypt::encryptString(json_encode($data, JSON_THROW_ON_ERROR)), 'created_by' => $user->id, 'updated_by' => $user->id, 'created_at' => now(), 'updated_at' => now()]);

            return $this->present(DB::table('crm_records')->where('id', $newId)->first());
        });
    }

    public function linkTask(string $board, string $id, User $user, int $revision, ?string $taskId): array
    {
        return DB::transaction(function () use ($board, $id, $user, $revision, $taskId): array {
            DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
            $row = $this->accessible($board, $id, $user);
            abort_unless($row->kind === 'followup', 422);
            abort_unless((int) $row->revision === $revision, 409);
            $data = $this->data($row);
            $snapshot = $this->documents->load($board, 'kanban');
            if ($taskId) {
                abort_unless(in_array($taskId, array_column($snapshot['data']['tasks'], 'id'), true), 422, 'Zadanie nie istnieje.');
            } else {
                $taskId = (string) Str::uuid();
                $stamp = now()->toISOString();
                $snapshot['data']['tasks'][] = ['id' => $taskId, 'title' => 'CRM — zaplanowany kontakt', 'description' => 'Szczegóły dostępne w CRM dla uprawnionych osób.',
                    'dueDate' => '', 'createdAt' => $stamp, 'updatedAt' => $stamp, 'assigneeId' => null, 'assigneeIds' => [],
                    'status' => 'todo', 'priority' => 'medium', 'tags' => ['CRM'], 'subtasks' => []];
                $this->documents->save($board, 'kanban', $snapshot['data'], $snapshot['revision']);
            }
            $data['kanbanTaskId'] = $taskId;
            $this->history($row, $user->id);
            DB::table('crm_records')->where('id', $id)->update(['ciphertext' => Crypt::encryptString(json_encode($data, JSON_THROW_ON_ERROR)),
                'revision' => $revision + 1, 'updated_at' => now(), 'updated_by' => $user->id]);

            return $this->present(DB::table('crm_records')->where('id', $id)->first());
        });
    }
}
