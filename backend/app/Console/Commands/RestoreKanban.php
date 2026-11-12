<?php

namespace App\Console\Commands;

use App\Services\EncryptedBackup;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class RestoreKanban extends Command
{
    protected $signature = 'team:restore {file : Encrypted backup file}';

    protected $description = 'Restore a verified backup to an empty application database and private storage';

    public function handle(EncryptedBackup $backups): int
    {
        foreach (EncryptedBackup::TABLES as $table) {
            if (DB::table($table)->exists()) {
                $this->error('Refusing to overwrite a nonempty destination.');

                return self::FAILURE;
            }
        }
        $disk = Storage::disk('local');
        if ($disk->allFiles('images') !== [] || $disk->allFiles('crm-files') !== []) {
            $this->error('Refusing to overwrite existing private images.');

            return self::FAILURE;
        }
        $data = $backups->read($this->argument('file'));
        $written = [];
        try {
            DB::transaction(function () use ($data, $disk, $backups, &$written): void {
                foreach ($data['images'] as $image) {
                    $file = 'images/'.$image['id'].'.bin';
                    $written[] = $file;
                    $disk->put($file, $backups->imageCiphertext($this->argument('file'), $image));
                }
                foreach ($data['files'] as $file) {
                    $name = 'crm-files/'.$file['id'].'.bin';
                    $written[] = $name;
                    if (! $disk->put($name, $backups->fileCiphertext($this->argument('file'), $file))) {
                        throw new \RuntimeException('Cannot restore CRM file.');
                    }
                }
                foreach (EncryptedBackup::TABLES as $table) {
                    foreach (array_chunk($data['tables'][$table], 25) as $rows) {
                        DB::table($table)->insert($rows);
                    }
                }
                // Sessions and password-reset links are deliberately never restored.
                DB::table('sessions')->delete();
                DB::table('password_reset_tokens')->delete();
            });
        } catch (\Throwable $error) {
            foreach ($written as $file) {
                $disk->delete($file);
            }
            throw $error;
        }
        $this->info(json_encode(['restored' => true, 'users' => count($data['tables']['users']),
            'documents' => count($data['tables']['documents']), 'images' => count($data['images']), 'crm_records' => count($data['tables']['crm_records']), 'crm_files' => count($data['files'])]));

        return self::SUCCESS;
    }
}
