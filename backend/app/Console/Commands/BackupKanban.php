<?php

namespace App\Console\Commands;

use App\Services\EncryptedBackup;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class BackupKanban extends Command
{
    protected $signature = 'team:backup {--verify= : Verify and decrypt an existing backup}';

    protected $description = 'Create and verify an encrypted application backup outside the public directory';

    public function handle(EncryptedBackup $backups): int
    {
        if ($this->option('verify')) {
            $path = realpath($this->option('verify'));
            $data = $path ? $backups->read($path) : null;
            if (! in_array($data['format'] ?? null, ['intelispaces-team-backup-v1', 'intelispaces-team-backup-v2', 'intelispaces-team-backup-v3'], true)) {
                throw new \RuntimeException('Invalid backup.');
            }
            foreach ($data['images'] as $image) {
                $bytes = Crypt::decryptString($backups->imageCiphertext($path, $image));
                if (! hash_equals($image['sha256'], hash('sha256', $bytes))) {
                    throw new \RuntimeException('Backup image checksum failed.');
                }
            }
            foreach ($data['tables']['documents'] as $document) {
                json_decode(Crypt::decryptString($document['ciphertext']), true, 512, JSON_THROW_ON_ERROR);
            }
            $this->info(json_encode(['verified' => true, 'images' => count($data['images']), 'documents' => count($data['tables']['documents']), 'crm_records' => count($data['tables']['crm_records']), 'crm_files' => count($data['files'])]));

            return self::SUCCESS;
        }
        $directory = config('team.backup_directory');
        if (! is_dir($directory) && ! mkdir($directory, 0700, true)) {
            throw new \RuntimeException('Cannot create private backup directory.');
        }
        $directory = realpath($directory);
        if (! $directory || str_starts_with($directory, realpath(public_path()))) {
            throw new \RuntimeException('Backup directory must be private.');
        }
        $snapshot = DB::transaction(function (): array {
            DB::table('boards')->orderBy('id')->lockForUpdate()->get();
            $tables = [];
            foreach (EncryptedBackup::TABLES as $table) {
                $tables[$table] = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
            }
            $images = [];
            foreach ($tables['private_images'] as $image) {
                $ciphertext = Storage::disk('local')->get('images/'.$image['id'].'.bin');
                $bytes = Crypt::decryptString($ciphertext);
                if (! hash_equals($image['sha256'], hash('sha256', $bytes))) {
                    throw new \RuntimeException('Source image integrity check failed.');
                }
                $images[] = ['id' => $image['id'], 'sha256' => $image['sha256']];
            }

            $files = [];
            foreach ($tables['crm_files'] as $file) {
                $bytes = Crypt::decryptString(Storage::disk('local')->get('crm-files/'.$file['id'].'.bin'));
                if (! hash_equals($file['sha256'], hash('sha256', $bytes))) {
                    throw new \RuntimeException('CRM source file integrity check failed.');
                }
                $files[] = ['id' => $file['id'], 'sha256' => $file['sha256']];
            }

            return ['format' => 'intelispaces-team-backup-v3', 'created_at' => now()->toISOString(), 'tables' => $tables, 'images' => $images, 'files' => $files];
        });
        $path = $directory.'/team-'.now()->format('Ymd-His').'-'.bin2hex(random_bytes(4)).'.enc';
        $temporary = $path.'.partial';
        $zip = new ZipArchive;
        if ($zip->open($temporary, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
            throw new \RuntimeException('Cannot create encrypted backup.');
        }
        try {
            $zip->addFromString('manifest.enc', Crypt::encryptString(json_encode($snapshot, JSON_THROW_ON_ERROR)));
            foreach ($snapshot['files'] as $file) {
                $name = 'crm-files/'.$file['id'].'.bin';
                if (! $zip->addFile(Storage::disk('local')->path($name), $name)) {
                    throw new \RuntimeException('Cannot add encrypted CRM file.');
                }
                $zip->setCompressionName($name, ZipArchive::CM_STORE);
            }
            foreach ($snapshot['images'] as $image) {
                $name = 'images/'.$image['id'].'.bin';
                if (! $zip->addFile(Storage::disk('local')->path($name), $name)) {
                    throw new \RuntimeException('Cannot add encrypted image.');
                }
                $zip->setCompressionName($name, ZipArchive::CM_STORE);
            }
        } finally {
            if (! $zip->close()) {
                throw new \RuntimeException('Incomplete backup write.');
            }
        }
        chmod($temporary, 0600);
        $backups->read($temporary);
        if (! rename($temporary, $path)) {
            throw new \RuntimeException('Cannot finalize backup.');
        }
        chmod($path, 0600);
        $this->call('team:backup', ['--verify' => $path]);
        foreach (glob($directory.'/team-*.enc') ?: [] as $older) {
            if (! is_link($older) && preg_match('/^team-\d{8}-\d{6}-[a-f0-9]{8}\.enc$/D', basename($older))
                && filemtime($older) < now()->subDays(14)->timestamp && $older !== $path) {
                unlink($older);
            }
        }
        $this->info(json_encode(['backup' => $path, 'sha256' => hash_file('sha256', $path)]));

        return self::SUCCESS;
    }
}
