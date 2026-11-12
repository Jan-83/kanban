<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PrivateImages
{
    public function validPath(string $path, string $board): bool
    {
        return str_starts_with($path, $board.'/')
            && preg_match('/^[0-9a-f-]{36}\/[a-zA-Z0-9_-]{1,120}\/[a-zA-Z0-9_-]{1,120}\.(jpg|png|webp)$/iD', $path);
    }

    public function store(string $board, string $path, string $name, string $bytes, ?string $timestamp = null): array
    {
        abort_unless($this->validPath($path, $board) && strlen($bytes) > 0 && strlen($bytes) <= 5242880, 422);
        $info = @getimagesizefromstring($bytes);
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        abort_unless($info && in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)
            && $info[0] <= 12000 && $info[1] <= 12000 && $info[0] * $info[1] <= 40000000, 422, 'Nieprawidłowy obraz lub przekroczone wymiary.');
        $extension = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime];
        abort_unless(str_ends_with($path, '.'.$extension), 422);
        $id = hash('sha256', $path);
        $sha = hash('sha256', $bytes);

        return DB::transaction(function () use ($board, $path, $name, $bytes, $timestamp, $mime, $id, $sha): array {
            DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
            $existing = DB::table('private_images')->where('id', $id)->first();
            if ($existing) {
                abort_unless(hash_equals($existing->sha256, $sha), 409);

                return $this->metadata($existing);
            }
            abort_if(DB::table('private_images')->where('board_id', $board)->sum('bytes') + DB::table('crm_files')->where('board_id', $board)->sum('bytes') + strlen($bytes) > config('team.file_quota_bytes'), 422, 'Magazyn zdjęć osiągnął limit. Skontaktuj się z administratorem.');
            $disk = Storage::disk('local');
            $file = 'images/'.$id.'.bin';
            if ($disk->exists($file)) {
                abort_unless(hash_equals($sha, hash('sha256', Crypt::decryptString($disk->get($file)))), 409);
            } elseif (! $disk->put($file, Crypt::encryptString($bytes))) {
                throw new \RuntimeException('Private storage write failed.');
            }
            DB::table('private_images')->insert(['id' => $id, 'board_id' => $board, 'path' => $path,
                'name' => Crypt::encryptString(mb_substr($name, 0, 200)), 'mime' => $mime, 'bytes' => strlen($bytes),
                'sha256' => $sha, 'created_at' => $timestamp ?? now()]);

            return $this->metadata(DB::table('private_images')->where('id', $id)->first());
        });
    }

    public function metadata(object $image): array
    {
        return ['id' => pathinfo($image->path, PATHINFO_FILENAME), 'path' => $image->path,
            'name' => Crypt::decryptString($image->name), 'mimeType' => $image->mime, 'size' => (int) $image->bytes,
            'uploadedAt' => Carbon::parse($image->created_at)->toISOString()];
    }

    public function read(string $board, string $path): array
    {
        abort_unless($this->validPath($path, $board), 404);
        $image = DB::table('private_images')->where('id', hash('sha256', $path))->where('board_id', $board)->first();
        abort_unless($image, 404);
        $bytes = Crypt::decryptString(Storage::disk('local')->get('images/'.$image->id.'.bin'));
        if (! hash_equals($image->sha256, hash('sha256', $bytes))) {
            throw new \RuntimeException('Private image integrity check failed.');
        }

        return [$image, $bytes];
    }
}
