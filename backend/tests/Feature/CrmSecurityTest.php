<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CrmFiles;
use App\Services\CrmRecords;
use App\Services\EncryptedBackup;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CrmSecurityTest extends TestCase
{
    use LazilyRefreshDatabase;

    private const BOARD = 'b9e5466d-b243-4660-b8a3-25271eadbed5';

    private const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

    private const PASSWORD = 'A-local-test-password-2026';

    private const CSRF = 'test-only-csrf-token-not-a-production-secret';

    private function boardData(): array
    {
        return ['tasks' => [], 'members' => [], 'stages' => [
            ['id' => 'todo', 'title' => 'Do zrobienia', 'color' => '#64748b'],
            ['id' => 'in_progress', 'title' => 'W toku', 'color' => '#d97706'],
            ['id' => 'done', 'title' => 'Zrobione', 'color' => '#0d9488'],
        ]];
    }

    private function member(bool $mfa = true, string $role = 'member'): User
    {
        $user = User::factory()->create(['password' => Hash::make(self::PASSWORD), 'mfa_secret' => $mfa ? self::SECRET : null,
            'mfa_confirmed_at' => $mfa ? now() : null])->refresh();
        if (! DB::table('boards')->where('id', self::BOARD)->exists()) {
            DB::table('boards')->insert(['id' => self::BOARD, 'name' => Crypt::encryptString('Synthetic board'), 'created_at' => now(), 'updated_at' => now()]);
            DB::table('documents')->insert(['board_id' => self::BOARD, 'kind' => 'kanban', 'revision' => 7,
                'ciphertext' => Crypt::encryptString(json_encode($this->boardData())), 'updated_at' => now()]);
            DB::table('documents')->insert(['board_id' => self::BOARD, 'kind' => 'strategy', 'revision' => 2,
                'ciphertext' => Crypt::encryptString('{"version":2,"cards":[]}'), 'updated_at' => now()]);
        }
        DB::table('memberships')->insert(['board_id' => self::BOARD, 'user_id' => $user->id, 'display_name' => 'Test member', 'role' => $role]);

        return $user;
    }

    private function authenticated(User $user, bool $mfa = true): static
    {
        return $this->actingAs($user)->withSession(['_token' => self::CSRF, 'password_at' => now()->timestamp,
            'seen_at' => now()->timestamp, 'auth_version' => $user->auth_version, 'mfa_verified' => $mfa])
            ->withHeaders(['X-CSRF-TOKEN' => self::CSRF, 'Origin' => 'http://localhost']);
    }

    private function path(string $suffix = ''): string
    {
        return '/api/boards/'.self::BOARD.'/crm'.$suffix;
    }

    private function input(User $user, string $kind = 'company', array $data = [], ?string $parent = null): array
    {
        return ['kind' => $kind, 'parentId' => $parent, 'ownerId' => $user->id, 'visibility' => 'restricted', 'accessIds' => [], 'revision' => 0,
            'data' => $data + ['title' => 'Private synthetic client', 'notes' => 'Confidential needs and budget']];
    }

    private function record(User $user, string $kind = 'company', array $data = [], ?string $parent = null): array
    {
        return app(CrmRecords::class)->save(self::BOARD, $user, $this->input($user, $kind, $data, $parent));
    }

    private function editable(array $record): array
    {
        unset($record['id'], $record['createdAt'], $record['updatedAt']);
        unset($record['data']['version'], $record['data']['seriesId'], $record['data']['sentAt'], $record['data']['kanbanTaskId']);

        return $record;
    }

    public function test_crm_requires_identity_mfa_and_authoritative_membership(): void
    {
        $this->getJson($this->path())->assertUnauthorized();
        $user = $this->member();
        $this->authenticated($user, false)->getJson($this->path())->assertForbidden();
        $this->authenticated($user)->getJson($this->path())->assertOk()->assertJsonCount(0, 'records');
        DB::table('memberships')->where('user_id', $user->id)->delete();
        $this->getJson($this->path())->assertNotFound();
    }

    public function test_restricted_parent_protects_child_records_files_and_history(): void
    {
        Storage::fake('local');
        $owner = $this->member();
        $other = $this->member();
        $company = $this->record($owner);
        $childInput = $this->input($owner, 'activity', ['type' => 'note'], $company['id']);
        $childInput['visibility'] = 'team';
        $child = app(CrmRecords::class)->save(self::BOARD, $owner, $childInput);
        $file = app(CrmFiles::class)->store(self::BOARD, $child['id'], $owner, UploadedFile::fake()->createWithContent('plan.pdf', "%PDF-1.7\nprivate-test"));
        $this->authenticated($other)->getJson($this->path())->assertOk()->assertJsonCount(0, 'records');
        $this->getJson($this->path('/records/'.$child['id']))->assertNotFound();
        $this->get($this->path('/files/'.$file['id']))->assertNotFound();
        $this->putJson($this->path('/records/'.$child['id']), $this->editable($child))->assertNotFound();
        $this->deleteJson($this->path('/records/'.$child['id']), ['revision' => 1])->assertNotFound();
        $admin = $this->member(role: 'admin');
        $this->authenticated($admin)->getJson($this->path('/records/'.$child['id']))->assertOk()->assertJsonPath('record.data.title', 'Private synthetic client');
        $this->assertDatabaseCount('crm_versions', 0);
    }

    public function test_valid_create_encrypts_payload_and_rejects_unexpected_fields(): void
    {
        $user = $this->member();
        $input = $this->input($user);
        $created = $this->authenticated($user)->postJson($this->path('/records'), $input)->assertCreated()->assertJsonPath('revision', 1)->json();
        $stored = DB::table('crm_records')->where('id', $created['id'])->first();
        $this->assertStringNotContainsString('Private synthetic client', $stored->ciphertext);
        $this->assertSame('Confidential needs and budget', app(CrmRecords::class)->data($stored)['notes']);
        $input['data']['admin'] = true;
        $this->postJson($this->path('/records'), $input)->assertUnprocessable()->assertJsonPath('message', 'Formularz zawiera nieobsługiwane pola.');
        $this->assertDatabaseCount('crm_records', 1);
    }

    public function test_shared_editor_cannot_broaden_acl_or_reparent_record(): void
    {
        $owner = $this->member();
        $editor = $this->member();
        $input = $this->input($owner);
        $input['accessIds'] = [$editor->id];
        $record = app(CrmRecords::class)->save(self::BOARD, $owner, $input);
        $update = $this->editable($record);
        $update['visibility'] = 'team';
        $this->authenticated($editor)->putJson($this->path('/records/'.$record['id']), $update)->assertForbidden();
        $update['visibility'] = 'restricted';
        $update['data']['notes'] = 'Agreed new details';
        $this->putJson($this->path('/records/'.$record['id']), $update)->assertOk()->assertJsonPath('revision', 2);
        $this->assertDatabaseCount('crm_versions', 1);
    }

    public function test_stale_revision_cannot_overwrite_newer_data(): void
    {
        $user = $this->member();
        $record = $this->record($user);
        $input = $this->editable($record);
        $input['data']['title'] = 'New authoritative name';
        $this->authenticated($user)->putJson($this->path('/records/'.$record['id']), $input)->assertOk()->assertJsonPath('revision', 2);
        $input['data']['title'] = 'Stale name';
        $this->putJson($this->path('/records/'.$record['id']), $input)->assertConflict();
        $this->getJson($this->path('/records/'.$record['id']))->assertOk()->assertJsonPath('record.data.title', 'New authoritative name')->assertJsonCount(1, 'history');
        $this->assertDatabaseCount('crm_versions', 1);
    }

    public function test_cycles_and_cross_board_references_are_rejected_without_changes(): void
    {
        $user = $this->member();
        $company = $this->record($user);
        $contact = $this->record($user, 'contact', [], $company['id']);
        $update = $this->editable($company);
        $update['parentId'] = $contact['id'];
        $this->authenticated($user)->putJson($this->path('/records/'.$company['id']), $update)->assertUnprocessable();
        $update['parentId'] = '00000000-0000-4000-8000-000000000123';
        $this->putJson($this->path('/records/'.$company['id']), $update)->assertUnprocessable();
        $this->assertDatabaseCount('crm_versions', 0);
    }

    public function test_outlook_links_and_upload_content_cannot_be_active_payloads(): void
    {
        Storage::fake('local');
        $user = $this->member();
        $record = $this->record($user);
        $input = $this->input($user, 'activity', ['type' => 'email', 'outlookUrl' => 'javascript:alert(1)'], $record['id']);
        $this->authenticated($user)->postJson($this->path('/records'), $input)->assertUnprocessable();
        $input['data']['outlookUrl'] = 'https://outlook.office.com.evil.test/mail/a';
        $this->postJson($this->path('/records'), $input)->assertUnprocessable();
        $input['data']['outlookUrl'] = 'https://outlook.office.com/mail/deeplink/read/test';
        $this->postJson($this->path('/records'), $input)->assertCreated();
        $this->post($this->path('/records/'.$record['id'].'/files'), ['file' => UploadedFile::fake()->createWithContent('plan.pdf', '<script>alert(1)</script>')])->assertUnprocessable();
        $this->assertDatabaseCount('crm_files', 0);
        Storage::disk('local')->assertDirectoryEmpty('crm-files');
    }

    public function test_pdf_bytes_are_encrypted_and_download_is_private_attachment(): void
    {
        Storage::fake('local');
        $user = $this->member();
        $record = $this->record($user);
        $bytes = "%PDF-1.7\nprivate-client-pdf-data";
        $file = $this->authenticated($user)->post($this->path('/records/'.$record['id'].'/files'), ['file' => UploadedFile::fake()->createWithContent('plan.pdf', $bytes)])->assertCreated()->json();
        $ciphertext = Storage::disk('local')->get('crm-files/'.$file['id'].'.bin');
        $this->assertStringNotContainsString('private-client-pdf-data', $ciphertext);
        $this->assertSame($bytes, Crypt::decryptString($ciphertext));
        $this->get($this->path('/files/'.$file['id']))->assertOk()->assertDownload('plan.pdf')->assertHeader('X-Content-Type-Options', 'nosniff')->assertStreamedContent($bytes);
        $this->deleteJson($this->path('/files/'.$file['id']))->assertOk();
        $this->get($this->path('/files/'.$file['id']))->assertNotFound();
        Storage::disk('local')->assertExists('crm-files/'.$file['id'].'.bin');
    }

    public function test_offer_versions_preserve_old_offer_and_cannot_spoof_version(): void
    {
        $user = $this->member();
        $record = $this->record($user, 'offer', ['number' => 'TEST/1', 'status' => 'sent', 'currency' => 'PLN', 'valueCents' => 12345]);
        $next = $this->authenticated($user)->postJson($this->path('/records/'.$record['id'].'/version'), ['revision' => 1])->assertCreated()->assertJsonPath('data.version', 2)->assertJsonPath('data.status', 'draft')->json();
        $this->postJson($this->path('/records/'.$record['id'].'/version'), ['revision' => 1])->assertConflict();
        $this->assertSame($record['data']['seriesId'], $next['data']['seriesId']);
        $this->getJson($this->path('/records/'.$record['id']))->assertJsonPath('record.data.status', 'sent')->assertJsonPath('record.data.version', 1);
        $input = $this->editable($next);
        $input['data']['version'] = 999;
        $this->putJson($this->path('/records/'.$next['id']), $input)->assertUnprocessable();
        $this->assertDatabaseCount('crm_records', 2);
    }

    public function test_kanban_link_does_not_disclose_private_client_details(): void
    {
        $user = $this->member();
        $record = $this->record($user, 'followup', ['type' => 'call', 'status' => 'open', 'priority' => 'urgent']);
        $linked = $this->authenticated($user)->postJson($this->path('/records/'.$record['id'].'/task'), ['revision' => 1, 'taskId' => null])->assertOk()->assertJsonPath('revision', 2)->json();
        $board = $this->getJson('/api/boards/'.self::BOARD.'/kanban')->assertOk()->assertJsonPath('revision', 8)->json();
        $this->assertSame($linked['data']['kanbanTaskId'], $board['data']['tasks'][0]['id']);
        $this->assertStringNotContainsString('Private synthetic client', json_encode($board));
        $this->assertStringNotContainsString('Confidential', json_encode($board));
        $this->postJson($this->path('/records/'.$record['id'].'/task'), ['revision' => 1, 'taskId' => null])->assertConflict();
        $this->assertDatabaseHas('documents', ['kind' => 'kanban', 'revision' => 8]);
    }

    public function test_rules_and_settings_are_admin_only_and_repeated_reminders_are_idempotent(): void
    {
        $this->freezeTime();
        $user = $this->member();
        $admin = $this->member(role: 'admin');
        $ruleInput = $this->input($user, 'rule', ['enabled' => true, 'trigger' => 'offer_sent', 'days' => 14, 'delayDays' => 3, 'action' => 'followup', 'taskType' => 'call']);
        $this->authenticated($user)->postJson($this->path('/records'), $ruleInput)->assertForbidden();
        $this->putJson($this->path('/settings'), ['revision' => 0, 'data' => app(CrmRecords::class)->settings(self::BOARD)['data']])->assertForbidden();
        $ruleInput['ownerId'] = $admin->id;
        app(CrmRecords::class)->save(self::BOARD, $admin, $ruleInput);
        $offerInput = $this->input($user, 'offer', ['number' => 'TEST/2', 'status' => 'sent', 'currency' => 'PLN']);
        $offer = $this->postJson($this->path('/records'), $offerInput)->assertCreated()->json();
        $this->assertDatabaseCount('crm_notifications', 1);
        $this->assertDatabaseHas('crm_records', ['kind' => 'followup', 'parent_id' => $offer['id']]);
        $this->putJson($this->path('/records/'.$offer['id']), $this->editable($offer))->assertOk();
        $this->assertDatabaseCount('crm_notifications', 1);
        $this->travel(4)->days();
        $this->artisan('team:crm-reminders')->assertSuccessful();
        $this->artisan('team:crm-reminders')->assertSuccessful();
        $this->assertDatabaseCount('crm_notifications', 2);
        $this->assertDatabaseCount('crm_automation_runs', 2);
    }

    public function test_crm_backup_restores_permissions_versions_and_exact_file_bytes(): void
    {
        Storage::fake('local');
        $disk = Storage::disk('local');
        config(['team.backup_directory' => $disk->path('backups')]);
        $user = $this->member();
        $other = $this->member();
        $record = $this->record($user);
        $updated = $this->editable($record);
        $updated['data']['notes'] = 'Revised private information';
        app(CrmRecords::class)->save(self::BOARD, $user, $updated, $record['id']);
        $bytes = "%PDF-1.7\nbackup-roundtrip-secret";
        $file = app(CrmFiles::class)->store(self::BOARD, $record['id'], $user, UploadedFile::fake()->createWithContent('plan.pdf', $bytes));
        $this->artisan('team:backup')->assertSuccessful();
        $path = $disk->path($disk->files('backups')[0]);
        $backup = app(EncryptedBackup::class)->read($path);
        $this->assertCount(1, $backup['files']);
        foreach (array_reverse(EncryptedBackup::TABLES) as $table) {
            DB::table($table)->delete();
        }
        $disk->deleteDirectory('crm-files');
        $this->artisan('team:restore', ['file' => $path])->assertSuccessful();
        $this->assertSame($bytes, app(CrmFiles::class)->read(self::BOARD, $file['id'], $user)[1]);
        $this->assertDatabaseCount('crm_versions', 1);
        $this->assertSame('Revised private information', app(CrmRecords::class)->details(self::BOARD, $record['id'], $user)['record']['data']['notes']);
        $this->authenticated($other)->getJson($this->path('/records/'.$record['id']))->assertNotFound();
        $this->assertDatabaseCount('sessions', 0);
    }

    public function test_settings_keep_deal_stage_references_valid_and_require_admin(): void
    {
        $admin = $this->member(role: 'admin');
        $deal = $this->record($admin, 'deal', ['stageId' => 'proposal', 'currency' => 'PLN', 'valueCents' => 10000]);
        $settings = app(CrmRecords::class)->settings(self::BOARD)['data'];
        $settings['stages'] = array_values(array_filter($settings['stages'], fn ($s) => $s['id'] !== 'proposal'));
        $this->authenticated($admin)->putJson($this->path('/settings'), ['revision' => 0, 'data' => $settings])->assertUnprocessable();
        $settings['stages'][] = ['id' => 'proposal', 'title' => 'Oferta dopasowana', 'probability' => 65, 'color' => '#6655aa', 'outcome' => 'open'];
        $this->putJson($this->path('/settings'), ['revision' => 0, 'data' => $settings])->assertOk()->assertJsonPath('revision', 1);
        $this->putJson($this->path('/settings'), ['revision' => 0, 'data' => $settings])->assertConflict();
        $this->assertSame('proposal', app(CrmRecords::class)->details(self::BOARD, $deal['id'], $admin)['record']['data']['stageId']);
    }

    public function test_inactive_rule_observes_new_nested_contact_and_does_not_repeat(): void
    {
        $this->freezeTime();
        $admin = $this->member(role: 'admin');
        $company = $this->record($admin);
        $this->record($admin, 'rule', ['title' => 'Contact after inactivity', 'enabled' => true, 'trigger' => 'inactive', 'days' => 7, 'delayDays' => 1, 'action' => 'notice', 'taskType' => 'call']);
        $this->travel(8)->days();
        $this->artisan('team:crm-reminders')->assertSuccessful();
        $this->artisan('team:crm-reminders')->assertSuccessful();
        $this->assertDatabaseCount('crm_notifications', 1);
        $this->record($admin, 'activity', ['type' => 'call', 'occurredAt' => now()->format('Y-m-d\TH:i:sP')], $company['id']);
        $this->artisan('team:crm-reminders')->assertSuccessful();
        $this->assertDatabaseCount('crm_notifications', 1);
        $this->travel(8)->days();
        $this->artisan('team:crm-reminders')->assertSuccessful();
        $this->assertDatabaseCount('crm_notifications', 2);
    }

    public function test_member_revocation_removes_notifications_and_file_access(): void
    {
        Storage::fake('local');
        $owner = $this->member();
        $editor = $this->member();
        $input = $this->input($owner, 'followup', ['title' => 'Private reminder', 'type' => 'call', 'status' => 'open', 'priority' => 'medium', 'assigneeId' => $editor->id, 'dueAt' => now()->subHour()->format('Y-m-d\TH:i:sP')]);
        $input['accessIds'] = [$editor->id];
        $record = app(CrmRecords::class)->save(self::BOARD, $owner, $input);
        $file = app(CrmFiles::class)->store(self::BOARD, $record['id'], $owner, UploadedFile::fake()->createWithContent('plan.pdf', "%PDF-1.7\nprivate"));
        $this->artisan('team:crm-reminders')->assertSuccessful();
        $this->authenticated($editor)->getJson($this->path())->assertJsonCount(1, 'notifications');
        $input = $this->editable($record);
        $input['accessIds'] = [];
        app(CrmRecords::class)->save(self::BOARD, $owner, $input, $record['id']);
        $this->getJson($this->path())->assertJsonCount(0, 'records')->assertJsonCount(0, 'notifications');
        $this->get($this->path('/files/'.$file['id']))->assertNotFound();
    }

    public function test_crm_rejects_cross_origin_write_and_non_integer_money(): void
    {
        $user = $this->member();
        $input = $this->input($user, 'deal', ['stageId' => 'new', 'currency' => 'PLN', 'valueCents' => '12300']);
        $this->authenticated($user)->postJson($this->path('/records'), $input)->assertUnprocessable();
        $input['data']['valueCents'] = 12300;
        $this->withHeader('Origin', 'https://evil.example')->postJson($this->path('/records'), $input)->assertForbidden();
        $this->assertDatabaseCount('crm_records', 0);
    }

    public function test_legacy_v2_backup_is_read_with_empty_crm_tables(): void
    {
        Storage::fake('local');
        $disk = Storage::disk('local');
        config(['team.backup_directory' => $disk->path('backups')]);
        $this->member();
        $this->artisan('team:backup')->assertSuccessful();
        $path = $disk->path($disk->files('backups')[0]);
        $backup = app(EncryptedBackup::class)->read($path);
        $backup['format'] = 'intelispaces-team-backup-v2';
        foreach (EncryptedBackup::CRM_TABLES as $table) {
            unset($backup['tables'][$table]);
        }
        unset($backup['files']);
        $zip = new \ZipArchive;
        $zip->open($path);
        $zip->addFromString('manifest.enc', Crypt::encryptString(json_encode($backup, JSON_THROW_ON_ERROR)));
        $zip->close();
        $read = app(EncryptedBackup::class)->read($path);
        $this->assertSame([], $read['files']);
        $this->assertSame([], $read['tables']['crm_records']);
        $this->assertCount(1, $read['tables']['users']);
    }
}
