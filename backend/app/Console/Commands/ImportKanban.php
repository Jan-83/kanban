<?php

namespace App\Console\Commands;

use App\Services\BoardDocuments;
use App\Services\PrivateImages;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ImportKanban extends Command
{
    protected $signature = 'team:import {directory : Private export directory}';

    protected $description = 'Import a verified Kanban export into an empty database without changing the source';

    public function handle(BoardDocuments $documents, PrivateImages $images): int
    {
        $directory = realpath($this->argument('directory'));
        if (! $directory || ! is_file($directory.'/source-initial.json') || ! is_file($directory.'/images-manifest.json')) {
            $this->error('The private export is incomplete.');

            return self::FAILURE;
        }
        if (DB::table('users')->exists() || DB::table('boards')->exists()) {
            $this->error('Refusing to overwrite a nonempty destination.');

            return self::FAILURE;
        }
        $source = json_decode(file_get_contents($directory.'/source-initial.json'), true, 512, JSON_THROW_ON_ERROR);
        $manifest = json_decode(file_get_contents($directory.'/images-manifest.json'), true, 512, JSON_THROW_ON_ERROR);
        if (($source['project'] ?? null) !== 'dvcaeyzckaqohpzbozum' || count($manifest) !== count($source['objects'] ?? [])) {
            $this->error('Unexpected export identity or file count.');

            return self::FAILURE;
        }
        foreach ($manifest as $image) {
            $expectedFile = hash('sha256', $image['path']).'.bin';
            if ($image['file'] !== $expectedFile || ! is_file($directory.'/images/'.$expectedFile)
                || ! hash_equals($image['sha256'], hash_file('sha256', $directory.'/images/'.$expectedFile))) {
                $this->error('Private image checksum verification failed.');

                return self::FAILURE;
            }
        }
        DB::transaction(function () use ($source, $manifest, $directory, $documents, $images): void {
            foreach ($source['users'] as $user) {
                $member = collect($source['memberships'])->firstWhere('user_id', $user['id']);
                $hash = $user['password_hash'] ?? '';
                if ($hash !== '' && ! preg_match('/^\$2[aby]\$\d{2}\$.{53}$/D', $hash)) {
                    throw new \RuntimeException('Unsupported source password hash.');
                }
                DB::table('users')->insert(['id' => $user['id'], 'email' => mb_strtolower($user['email']),
                    'name' => $member['display_name'], 'password' => $hash ?: Hash::make(Str::random(64)),
                    'email_verified_at' => $user['email_confirmed_at'] ? Carbon::parse($user['email_confirmed_at']) : null,
                    'active' => ! $user['banned_until'] || Carbon::parse($user['banned_until'])->isPast(),
                    'created_at' => Carbon::parse($user['created_at']), 'updated_at' => now()]);
            }
            foreach ($source['boards'] as $board) {
                DB::table('boards')->insert(['id' => $board['id'], 'name' => Crypt::encryptString($board['name']),
                    'created_at' => now(), 'updated_at' => now()]);
            }
            foreach ($source['memberships'] as $member) {
                abort_unless(in_array($member['role'], ['admin', 'member'], true), 422);
                DB::table('memberships')->insert(array_intersect_key($member, array_flip(['board_id', 'user_id', 'display_name', 'role'])));
            }
            $names = [];
            foreach ($source['boards'] as $board) {
                foreach ($board['data']['tasks'] as $task) {
                    foreach ($task['images'] ?? [] as $image) {
                        $names[$image['path']] = $image['name'];
                    }
                }
            }
            foreach ($source['strategies'] as $strategy) {
                foreach ($strategy['data']['cards'] as $card) {
                    foreach ($card['task']['images'] ?? [] as $image) {
                        $names[$image['path']] = $image['name'];
                    }
                }
            }
            foreach ($manifest as $image) {
                $boardId = explode('/', $image['path'])[0];
                $images->store($boardId, $image['path'], $names[$image['path']] ?? basename($image['path']),
                    file_get_contents($directory.'/images/'.$image['file']), Carbon::parse($image['created_at'])->toDateTimeString());
            }
            foreach (['kanban' => $source['boards'], 'strategy' => $source['strategies']] as $kind => $rows) {
                foreach ($rows as $row) {
                    $boardId = $row['board_id'] ?? $row['id'];
                    $documents->validate($row['data'], $kind, $boardId);
                    DB::table('documents')->insert(['board_id' => $boardId, 'kind' => $kind, 'revision' => $row['revision'],
                        'ciphertext' => Crypt::encryptString(json_encode($row['data'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)),
                        'updated_at' => Carbon::parse($row['updated_at'])]);
                    $actual = $documents->load($boardId, $kind);
                    if ($actual['data'] !== $row['data'] || $actual['revision'] !== $row['revision']) {
                        throw new \RuntimeException('Imported document verification failed.');
                    }
                }
            }
            foreach (collect($source['calendar_events'] ?? [])->groupBy('board_id') as $boardId => $events) {
                $data = $events->values()->all();
                DB::table('documents')->insert(['board_id' => $boardId, 'kind' => 'calendar_archive', 'revision' => 0,
                    'ciphertext' => Crypt::encryptString(json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)),
                    'updated_at' => now()]);
                if ($documents->load($boardId, 'calendar_archive')['data'] !== $data) {
                    throw new \RuntimeException('Calendar archive verification failed.');
                }
            }
        });
        $this->info(json_encode(['imported' => true, 'users' => count($source['users']), 'boards' => count($source['boards']),
            'strategy_boards' => count($source['strategies']), 'images' => count($manifest),
            'archived_calendar_events' => count($source['calendar_events'] ?? [])], JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
