<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\EncryptedBackup;
use App\Services\PrivateImages;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BackupRestoreTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_complete_backup_restores_accounts_documents_and_original_image_bytes(): void
    {
        Storage::fake('local');
        $disk = Storage::disk('local');
        config(['team.backup_directory' => $disk->path('backups')]);
        $user = User::factory()->create()->refresh();
        $board = 'b9e5466d-b243-4660-b8a3-25271eadbed5';
        DB::table('boards')->insert(['id' => $board, 'name' => Crypt::encryptString('Synthetic'), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('memberships')->insert(['board_id' => $board, 'user_id' => $user->id, 'display_name' => 'Synthetic', 'role' => 'member']);
        DB::table('documents')->insert(['board_id' => $board, 'kind' => 'kanban', 'revision' => 17,
            'ciphertext' => Crypt::encryptString('{"tasks":[]}'), 'updated_at' => now()]);
        $path = $board.'/task-1/test.png';
        $image = UploadedFile::fake()->image('test.png', 3, 3);
        $bytes = file_get_contents($image->getPathname());
        app(PrivateImages::class)->store($board, $path, 'Test image', $bytes);
        $this->artisan('team:backup')->assertSuccessful();
        $backup = $disk->path($disk->files('backups')[0]);
        $snapshot = app(EncryptedBackup::class)->read($backup);
        $this->assertCount(1, $snapshot['images']);
        foreach (array_reverse(EncryptedBackup::TABLES) as $table) {
            DB::table($table)->delete();
        }
        $disk->deleteDirectory('images');
        $this->artisan('team:restore', ['file' => $backup])->assertSuccessful();
        $this->assertSame($bytes, app(PrivateImages::class)->read($board, $path)[1]);
        $this->assertSame($user->password, User::findOrFail($user->id)->password);
        $this->assertDatabaseHas('documents', ['revision' => 17]);
        $this->assertDatabaseCount('sessions', 0);
        $this->artisan('team:restore', ['file' => $backup])->assertFailed();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_modified_encrypted_backup_is_rejected_before_restore(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('tampered.enc', 'modified-by-an-attacker');
        $this->expectException(DecryptException::class);
        app(EncryptedBackup::class)->read(Storage::disk('local')->path('tampered.enc'));
    }
}
