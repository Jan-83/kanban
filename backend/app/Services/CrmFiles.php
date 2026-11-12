<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CrmFiles
{
    public function __construct(private CrmRecords $records) {}

    public function store(string $board, string $record, User $user, UploadedFile $upload): array
    {
        $this->records->accessible($board, $record, $user);
        abort_unless($upload->isValid() && $upload->getSize() > 0 && $upload->getSize() <= 5242880, 422, 'Maksymalny rozmiar pliku to 5 MB.');
        $bytes = file_get_contents($upload->getRealPath());
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $extensions = ['application/pdf' => ['pdf'], 'image/jpeg' => ['jpg', 'jpeg'], 'image/png' => ['png'], 'image/webp' => ['webp']];
        abort_unless(isset($extensions[$mime]) && in_array(strtolower($upload->getClientOriginalExtension()), $extensions[$mime], true), 422, 'Dodaj PDF, JPG, PNG lub WebP.');
        if ($mime === 'application/pdf') {
            abort_unless(str_starts_with($bytes, '%PDF-'), 422, 'Nieprawidłowy plik PDF.');
        } else {
            $info = @getimagesizefromstring($bytes);
            abort_unless($info && $info[0] <= 12000 && $info[1] <= 12000 && $info[0] * $info[1] <= 40000000, 422, 'Nieprawidłowe wymiary zdjęcia.');
        }
        $id = (string) Str::uuid();
        $file = 'crm-files/'.$id.'.bin';
        try {
            return DB::transaction(function () use ($board, $record, $user, $upload, $bytes, $mime, $id, $file): array {
                DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
                $this->records->accessible($board, $record, $user);
                $used = DB::table('private_images')->where('board_id', $board)->sum('bytes') + DB::table('crm_files')->where('board_id', $board)->sum('bytes');
                abort_if($used + strlen($bytes) > config('team.file_quota_bytes'), 422, 'Magazyn plików osiągnął limit. Skontaktuj się z administratorem.');
                abort_if(DB::table('crm_files')->where('record_id', $record)->whereNull('deleted_at')->count() >= 100, 422, 'Limit 100 plików w jednym rekordzie.');
                if (! Storage::disk('local')->put($file, Crypt::encryptString($bytes))) {
                    throw new \RuntimeException('Private file write failed.');
                }
                $name = mb_substr(preg_replace('/[\x00-\x1f\x7f\/\\\\]/u', '_', $upload->getClientOriginalName()), 0, 180);
                DB::table('crm_files')->insert(['id' => $id, 'board_id' => $board, 'record_id' => $record, 'name' => Crypt::encryptString($name),
                    'mime' => $mime, 'bytes' => strlen($bytes), 'sha256' => hash('sha256', $bytes), 'created_by' => $user->id, 'created_at' => now()]);

                return ['id' => $id, 'name' => $name, 'mime' => $mime, 'bytes' => strlen($bytes), 'createdAt' => now()->toISOString()];
            });
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($file);
            throw $error;
        }
    }

    public function read(string $board, string $id, User $user): array
    {
        $file = DB::table('crm_files')->where('id', $id)->where('board_id', $board)->whereNull('deleted_at')->first();
        abort_unless($file, 404);
        $this->records->accessible($board, $file->record_id, $user);
        $bytes = Crypt::decryptString(Storage::disk('local')->get('crm-files/'.$file->id.'.bin'));
        if (! hash_equals($file->sha256, hash('sha256', $bytes)) || strlen($bytes) !== (int) $file->bytes) {
            throw new \RuntimeException('Private file integrity check failed.');
        }

        return [$file, $bytes];
    }

    public function archive(string $board, string $id, User $user): void
    {
        DB::transaction(function () use ($board, $id, $user): void {
            DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
            $file = DB::table('crm_files')->where('id', $id)->where('board_id', $board)->whereNull('deleted_at')->first();
            abort_unless($file, 404);
            $record = $this->records->accessible($board, $file->record_id, $user);
            abort_unless($file->created_by === $user->id || $record->owner_id === $user->id || $this->records->membership($board, $user)->role === 'admin', 403);
            DB::table('crm_files')->where('id', $id)->update(['deleted_at' => now()]);
        });
    }
}
