<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class BoardDocuments
{
    public function validate(array $data, string $kind, string $board): void
    {
        if (strlen(json_encode($data, JSON_THROW_ON_ERROR)) > config('team.max_document_bytes')) {
            throw ValidationException::withMessages(['data' => 'Tablica przekracza limit 2 MB.']);
        }
        if ($kind === 'kanban') {
            Validator::make($data, [
                'tasks' => ['present', 'array', 'max:5000'],
                'members' => ['present', 'array', 'max:200'],
                'stages' => ['required', 'array', 'min:3', 'max:20'],
                'stages.*.id' => ['required', 'string', 'max:120', 'distinct'],
                'stages.*.title' => ['required', 'string', 'max:48'],
                'stages.*.color' => ['required', 'regex:/^#[0-9a-f]{6}$/iD'],
                'members.*.id' => ['required', 'string', 'max:120', 'distinct'],
                'members.*.name' => ['required', 'string', 'max:120'],
                'members.*.email' => ['present', 'string', 'max:254'],
                'members.*.role' => ['present', 'string', 'max:120'],
                'members.*.status' => ['required', 'in:active,invited'],
                'members.*.color' => ['required', 'regex:/^#[0-9a-f]{6}$/iD'],
            ])->validate();
            abort_unless(count(array_diff(array_keys($data), ['tasks', 'members', 'stages'])) === 0, 422, 'Nieprawidłowy format tablicy.');
            $tasks = $data['tasks'];
            $stages = array_column($data['stages'], 'id');
            abort_unless(array_diff(['todo', 'in_progress', 'done'], $stages) === [], 422, 'Brakuje etapu podstawowego.');
            $memberIds = array_column($data['members'], 'id');
        } else {
            Validator::make($data, ['version' => ['required', 'integer', 'in:2'], 'cards' => ['present', 'array', 'max:1000'],
                'cards.*.task' => ['required', 'array'],
                'cards.*.parentIds' => ['present', 'array', 'max:1000'],
                'cards.*.position.x' => ['required', 'numeric', 'between:-10000000,10000000'],
                'cards.*.position.y' => ['required', 'numeric', 'between:-10000000,10000000'],
            ])->validate();
            abort_unless(count(array_diff(array_keys($data), ['version', 'cards'])) === 0, 422);
            $tasks = array_column($data['cards'], 'task');
            $stages = ['discuss', 'todo', 'in_progress', 'done', 'refine'];
            $this->validateGraph($data['cards']);
            $memberIds = null;
            foreach ($data['cards'] as $card) {
                foreach (['x', 'y'] as $axis) {
                    abort_unless(is_int($card['position'][$axis]) || is_float($card['position'][$axis]), 422);
                }
            }
        }
        $seen = [];
        foreach ($tasks as $task) {
            Validator::make($task, [
                'id' => ['required', 'string', 'regex:/^[a-zA-Z0-9_-]{1,120}$/D'],
                'title' => ['required', 'string', 'max:300'],
                'description' => ['present', 'string', 'max:10000'],
                'descriptionHtml' => ['sometimes', 'string', 'max:50000'],
                'closingStatus' => ['sometimes', 'string', 'max:10000'],
                'dueDate' => ['present', 'string', 'max:40'],
                'createdAt' => ['present', 'string', 'max:40'],
                'updatedAt' => ['present', 'string', 'max:40'],
                'assigneeId' => ['present', 'nullable', 'string', 'regex:/^[a-zA-Z0-9_-]{1,120}$/D'],
                'assigneeIds' => ['sometimes', 'array', 'max:200'],
                'assigneeIds.*' => ['required', 'string', 'distinct', 'regex:/^[a-zA-Z0-9_-]{1,120}$/D'],
                'color' => ['sometimes', 'regex:/^#[0-9a-f]{6}$/iD'],
                'status' => ['required', 'string'],
                'priority' => ['required', 'in:low,medium,high,urgent'],
                'tags' => ['present', 'array', 'max:30'],
                'tags.*' => ['present', 'string', 'max:100'],
                'subtasks' => ['present', 'array', 'max:100'],
                'subtasks.*.id' => ['required', 'string', 'distinct', 'regex:/^[a-zA-Z0-9_-]{1,120}$/D'],
                'subtasks.*.title' => ['present', 'string', 'max:300'],
                'subtasks.*.completed' => ['required', 'boolean:strict'],
                'statusComments' => ['sometimes', 'array', 'max:500'],
                'statusComments.*.id' => ['required', 'string', 'distinct', 'regex:/^[a-zA-Z0-9_-]{1,120}$/D'],
                'statusComments.*.text' => ['present', 'string', 'max:5000'],
                'statusComments.*.timestamp' => ['required', 'string', 'date', 'max:50'],
                'statusComments.*.author' => ['sometimes', 'string', 'max:120'],
                'images' => ['sometimes', 'array', 'max:12'],
                'images.*.id' => ['required', 'string', 'distinct', 'regex:/^[a-zA-Z0-9_-]{1,120}$/D'],
                'images.*.name' => ['required', 'string', 'max:200'],
                'images.*.size' => ['required', 'integer', 'min:1', 'max:5242880'],
                'images.*.mimeType' => ['required', 'in:image/jpeg,image/png,image/webp'],
                'images.*.uploadedAt' => ['required', 'string', 'date', 'max:50'],
            ])->validate();
            abort_unless($task['dueDate'] === '' || strtotime($task['dueDate']) !== false, 422);
            if (array_key_exists('assigneeIds', $task)) {
                abort_unless($task['assigneeId'] === ($task['assigneeIds'][0] ?? null), 422);
            }
            $assigned = $task['assigneeIds'] ?? ($task['assigneeId'] ? [$task['assigneeId']] : []);
            abort_unless($memberIds === null || array_diff($assigned, $memberIds) === [], 422);
            foreach (['tags', 'subtasks', 'statusComments', 'images', 'assigneeIds'] as $field) {
                abort_unless(! isset($task[$field]) || array_is_list($task[$field]), 422);
            }
            abort_if(isset($seen[$task['id']]) || ! in_array($task['status'], $stages, true), 422, 'Nieprawidłowe zadanie lub etap.');
            $seen[$task['id']] = true;
            foreach ($task['images'] ?? [] as $image) {
                $path = $image['path'] ?? '';
                $extension = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$image['mimeType']];
                abort_unless(is_string($path) && str_starts_with($path, $board.'/'.$task['id'].'/')
                    && str_ends_with($path, '/'.$image['id'].'.'.$extension) && is_int($image['size'])
                    && DB::table('private_images')->where('id', hash('sha256', $path))->where('board_id', $board)->exists(),
                    422, 'Nie potwierdzono zapisania zdjęcia.');
            }
        }
    }

    private function validateGraph(array $cards): void
    {
        $pending = [];
        $children = [];
        foreach ($cards as $card) {
            $id = $card['task']['id'] ?? null;
            abort_unless(is_string($id) && preg_match('/^[a-zA-Z0-9_-]{1,120}$/D', $id) && ! isset($pending[$id]), 422);
            abort_unless(! array_key_exists('parentId', $card) && count($card['parentIds']) === count(array_unique($card['parentIds'], SORT_REGULAR)), 422);
            foreach ($card['parentIds'] as $parent) {
                abort_unless(is_string($parent) && preg_match('/^[a-zA-Z0-9_-]{1,120}$/D', $parent), 422);
            }
            $pending[$id] = count($card['parentIds']);
        }
        $ready = [];
        foreach ($cards as $card) {
            $id = $card['task']['id'];
            if (! $pending[$id]) {
                $ready[] = $id;
            }
            foreach ($card['parentIds'] as $parent) {
                abort_unless(array_key_exists($parent, $pending), 422, 'Brak karty nadrzędnej.');
                $children[$parent][] = $id;
            }
        }
        for ($i = 0; $i < count($ready); $i++) {
            foreach ($children[$ready[$i]] ?? [] as $child) {
                $pending[$child]--;
                if ($pending[$child] === 0) {
                    $ready[] = $child;
                }
            }
        }
        abort_unless(count($ready) === count($cards), 422, 'Powiązania kart zawierają pętlę.');
    }

    public function load(string $board, string $kind): array
    {
        $row = DB::table('documents')->where('board_id', $board)->where('kind', $kind)->first();
        abort_unless($row, 404);

        return ['data' => json_decode(Crypt::decryptString($row->ciphertext), true, 512, JSON_THROW_ON_ERROR), 'revision' => (int) $row->revision];
    }

    public function save(string $board, string $kind, array $data, int $revision): array
    {
        $this->validate($data, $kind, $board);

        return DB::transaction(function () use ($board, $kind, $data, $revision): array {
            $query = DB::table('documents')->where('board_id', $board)->where('kind', $kind);
            $row = (clone $query)->lockForUpdate()->first();
            abort_unless($row, 404);
            abort_unless((int) $row->revision === $revision, 409);
            $ciphertext = Crypt::encryptString(json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
            DB::table('document_versions')->insert(['board_id' => $board, 'kind' => $kind, 'revision' => $revision,
                'ciphertext' => $row->ciphertext, 'created_at' => now()]);
            $changed = $query->where('revision', $revision)->update(['ciphertext' => $ciphertext, 'revision' => $revision + 1, 'updated_at' => now()]);
            abort_unless($changed === 1, 409);

            return ['data' => $data, 'revision' => $revision + 1];
        });
    }
}
