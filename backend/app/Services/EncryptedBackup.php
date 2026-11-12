<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use ZipArchive;

class EncryptedBackup
{
    public const LEGACY_TABLES = ['users', 'boards', 'memberships', 'documents', 'document_versions', 'private_images', 'audit_events'];

    public const CRM_TABLES = ['crm_records', 'crm_versions', 'crm_settings', 'crm_files', 'crm_notifications', 'crm_automation_runs'];

    public const TABLES = [...self::LEGACY_TABLES, ...self::CRM_TABLES];

    public function read(string $path): array
    {
        $zip = new ZipArchive;
        $zipped = $zip->open($path) === true;
        $content = $zipped ? $zip->getFromName('manifest.enc') : file_get_contents($path);
        if ($zipped) {
            $zip->close();
        }
        if (! is_string($content)) {
            throw new \RuntimeException('Missing encrypted backup manifest.');
        }
        $data = json_decode(Crypt::decryptString($content), true, 512, JSON_THROW_ON_ERROR);
        if (! in_array($data['format'] ?? null, ['intelispaces-team-backup-v1', 'intelispaces-team-backup-v2', 'intelispaces-team-backup-v3'], true)
            || array_keys($data['tables'] ?? []) !== (($data['format'] ?? '') === 'intelispaces-team-backup-v3' ? self::TABLES : self::LEGACY_TABLES)) {
            throw new \RuntimeException('Invalid backup format.');
        }
        if ($data['format'] !== 'intelispaces-team-backup-v3') {
            foreach (self::CRM_TABLES as $table) {
                $data['tables'][$table] = [];
            }
            $data['files'] = [];
        }
        $fileRecords = array_column($data['tables']['crm_files'], null, 'id');
        $fileSeen = [];
        foreach ($data['files'] as $file) {
            $id = $file['id'];
            if (! preg_match('/^[a-f0-9-]{36}$/D', $id) || isset($fileSeen[$id]) || ! isset($fileRecords[$id])) {
                throw new \RuntimeException('Invalid CRM backup file reference.');
            }
            $bytes = Crypt::decryptString($this->fileCiphertext($path, $file));
            if (! hash_equals($fileRecords[$id]['sha256'], hash('sha256', $bytes)) || $file['sha256'] !== $fileRecords[$id]['sha256'] || strlen($bytes) !== (int) $fileRecords[$id]['bytes']) {
                throw new \RuntimeException('CRM backup file checksum failed.');
            }
            Crypt::decryptString($fileRecords[$id]['name']);
            $fileSeen[$id] = true;
        }
        if (count($fileSeen) !== count($fileRecords)) {
            throw new \RuntimeException('CRM backup file is missing.');
        }
        foreach (array_merge($data['tables']['crm_records'], $data['tables']['crm_versions'], $data['tables']['crm_settings']) as $row) {
            json_decode(Crypt::decryptString($row['ciphertext']), true, 512, JSON_THROW_ON_ERROR);
        }
        foreach ($data['tables']['crm_notifications'] as $row) {
            Crypt::decryptString($row['ciphertext']);
        }
        $records = array_column($data['tables']['private_images'], null, 'id');
        $seen = [];
        foreach ($data['images'] as $image) {
            $id = $image['id'];
            if (! preg_match('/^[a-f0-9]{64}$/D', $id) || isset($seen[$id]) || ! isset($records[$id])
                || $id !== hash('sha256', $records[$id]['path'])) {
                throw new \RuntimeException('Invalid backup image reference.');
            }
            $ciphertext = $this->imageCiphertext($path, $image);
            $bytes = Crypt::decryptString($ciphertext);
            if (! hash_equals($records[$id]['sha256'], hash('sha256', $bytes))
                || $image['sha256'] !== $records[$id]['sha256'] || strlen($bytes) !== $records[$id]['bytes']) {
                throw new \RuntimeException('Backup image checksum failed.');
            }
            $seen[$id] = true;
        }
        if (count($seen) !== count($records)) {
            throw new \RuntimeException('Backup image is missing.');
        }
        foreach (array_merge($data['tables']['documents'], $data['tables']['document_versions']) as $document) {
            json_decode(Crypt::decryptString($document['ciphertext']), true, 512, JSON_THROW_ON_ERROR);
        }
        foreach ($data['tables']['users'] as $user) {
            foreach (['mfa_secret', 'recovery_hashes'] as $field) {
                if ($user[$field] !== null) {
                    Crypt::decryptString($user[$field]);
                }
            }
        }

        return $data;
    }

    public function fileCiphertext(string $path, array $file): string
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new \RuntimeException('Cannot open encrypted backup.');
        }
        try {
            $bytes = $zip->getFromName('crm-files/'.$file['id'].'.bin');
            if (! is_string($bytes)) {
                throw new \RuntimeException('CRM backup file is missing.');
            }

            return $bytes;
        } finally {
            $zip->close();
        }
    }

    public function imageCiphertext(string $path, array $image): string
    {
        if (isset($image['ciphertext'])) {
            return base64_decode($image['ciphertext'], true);
        }
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new \RuntimeException('Cannot open encrypted backup.');
        }
        try {
            $bytes = $zip->getFromName('images/'.$image['id'].'.bin');
            if (! is_string($bytes)) {
                throw new \RuntimeException('Backup image is missing.');
            }

            return $bytes;
        } finally {
            $zip->close();
        }
    }
}
