<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CrmRecords;
use App\Services\CrmSchema;
use App\Services\EncryptedBackup;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DesignerBoardTest extends TestCase
{
    use LazilyRefreshDatabase;

    private const BOARD = 'b9e5466d-b243-4660-b8a3-25271eadbed5';

    private const TOKEN = 'designer-test-csrf';

    private function member(string $role = 'member'): User
    {
        $user = User::factory()->create(['mfa_secret' => 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', 'mfa_confirmed_at' => now()])->refresh();
        DB::table('boards')->insertOrIgnore(['id' => self::BOARD, 'name' => Crypt::encryptString('Synthetic team'), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('memberships')->insert(['board_id' => self::BOARD, 'user_id' => $user->id, 'display_name' => 'Test member', 'role' => $role]);

        return $user;
    }

    private function auth(User $user): static
    {
        return $this->actingAs($user)->withSession(['_token' => self::TOKEN, 'password_at' => now()->timestamp,
            'seen_at' => now()->timestamp, 'auth_version' => $user->auth_version, 'mfa_verified' => true])
            ->withHeaders(['X-CSRF-TOKEN' => self::TOKEN, 'Origin' => 'http://localhost']);
    }

    private function path(string $suffix = ''): string
    {
        return '/api/boards/'.self::BOARD.'/crm'.$suffix;
    }

    private function input(User $user, array $data = []): array
    {
        return ['kind' => 'designer', 'parentId' => null, 'ownerId' => $user->id, 'visibility' => 'restricted', 'accessIds' => [], 'revision' => 0,
            'data' => $data + ['title' => 'Pracownia testowa', 'studio' => 'Fikcyjne Studio', 'categoryId' => 'new', 'strategyId' => 'showroom', 'notes' => 'Prywatne ustalenia']];
    }

    public function test_designer_category_strategy_and_contact_are_encrypted_and_versioned(): void
    {
        $user = $this->member();
        $input = $this->input($user, ['email' => 'test@example.test', 'city' => 'Łódź']);
        $created = $this->auth($user)->postJson($this->path('/records'), $input)->assertCreated()->assertJsonPath('data.strategyId', 'showroom')->json();
        $row = DB::table('crm_records')->where('id', $created['id'])->first();
        $this->assertStringNotContainsString('example.test', $row->ciphertext);
        $this->assertSame('Łódź', app(CrmRecords::class)->data($row)['city']);

        $input['revision'] = 1;
        $input['data']['categoryId'] = 'partner';
        $input['data']['strategyId'] = null;
        $this->putJson($this->path('/records/'.$created['id']), $input)->assertOk()->assertJsonPath('data.categoryId', 'partner')->assertJsonPath('data.strategyId', null)->assertJsonPath('revision', 2);
        $this->putJson($this->path('/records/'.$created['id']), $input)->assertConflict();
        $this->assertDatabaseCount('crm_versions', 1);
        $this->assertSame('partner', app(CrmRecords::class)->details(self::BOARD, $created['id'], $user)['record']['data']['categoryId']);
    }

    public function test_member_can_save_colored_tags_with_revision_history_and_restricted_access(): void
    {
        $owner = $this->member();
        $other = $this->member();
        $input = $this->input($owner, ['tags' => ['KNX', 'Historia zakupu'], 'tagColors' => ['KNX' => '#7c3aed', 'Historia zakupu' => '#16806a']]);
        $created = $this->auth($owner)->postJson($this->path('/records'), $input)->assertCreated()->assertJsonPath('data.tagColors.KNX', '#7c3aed')->json();
        $input['revision'] = 1;
        $input['data']['tagColors']['KNX'] = '#123456';

        $this->putJson($this->path('/records/'.$created['id']), $input)->assertOk()->assertJsonPath('revision', 2)->assertJsonPath('data.tagColors.KNX', '#123456');

        $this->assertSame('#123456', app(CrmRecords::class)->details(self::BOARD, $created['id'], $owner)['record']['data']['tagColors']['KNX']);
        $this->assertStringNotContainsString('#123456', DB::table('crm_records')->where('id', $created['id'])->value('ciphertext'));
        $this->assertDatabaseCount('crm_versions', 1);
        $this->putJson($this->path('/records/'.$created['id']), $input)->assertConflict();
        $input['revision'] = 2;
        $this->auth($other)->putJson($this->path('/records/'.$created['id']), $input)->assertNotFound();
        $this->assertDatabaseCount('crm_versions', 1);
    }

    public function test_tag_colors_reject_css_invalid_values_and_unassigned_tags_without_writes(): void
    {
        $owner = $this->member();
        $this->auth($owner);
        foreach (['url(https://example.test)', '#12345', ['nested' => '#123456']] as $color) {
            $input = $this->input($owner, ['tags' => ['KNX'], 'tagColors' => ['KNX' => $color]]);
            $this->postJson($this->path('/records'), $input)->assertUnprocessable()->assertJsonValidationErrors('tagColors.KNX');
        }
        $input = $this->input($owner, ['tags' => ['KNX'], 'tagColors' => ['Automatyka' => '#123456']]);
        $this->postJson($this->path('/records'), $input)->assertUnprocessable()->assertJsonPath('message', 'Kolor można przypisać tylko do tagu projektanta.');
        $this->assertDatabaseCount('crm_records', 0);
        $this->assertDatabaseCount('crm_versions', 0);
    }

    public function test_invalid_category_strategy_url_and_payload_keys_return_422_without_records(): void
    {
        $user = $this->member();
        $this->auth($user);
        foreach ([['categoryId' => 'unconfigured'], ['strategyId' => 'unconfigured'], ['website' => 'javascript:alert(1)'], ['secretRole' => 'admin']] as $invalid) {
            $this->postJson($this->path('/records'), $this->input($user, $invalid))->assertUnprocessable();
        }
        $this->assertDatabaseCount('crm_records', 0);
    }

    public function test_designer_notes_inherit_access_and_survive_a_profile_edit(): void
    {
        $this->freezeTime();
        $owner = $this->member();
        $other = $this->member();
        $designer = app(CrmRecords::class)->save(self::BOARD, $owner, $this->input($owner));
        $note = ['kind' => 'activity', 'parentId' => $designer['id'], 'ownerId' => $owner->id, 'visibility' => 'team', 'accessIds' => [], 'revision' => 0,
            'data' => ['title' => 'Rozmowa', 'type' => 'note', 'notes' => 'Poufny plan spotkania', 'occurredAt' => now()->format('Y-m-d\TH:i:sP')]];
        $saved = $this->auth($owner)->postJson($this->path('/records'), $note)->assertCreated()->json();
        $this->assertStringNotContainsString('Poufny', DB::table('crm_records')->where('id', $saved['id'])->value('ciphertext'));
        $this->auth($other)->getJson($this->path('/records/'.$saved['id']))->assertNotFound();
        $this->getJson($this->path())->assertOk()->assertJsonCount(0, 'records');
        $note['ownerId'] = $other->id;
        $this->postJson($this->path('/records'), $note)->assertUnprocessable();
        $updated = $this->input($owner, ['categoryId' => 'conversation']);
        $updated['revision'] = 1;
        $this->auth($owner)->putJson($this->path('/records/'.$designer['id']), $updated)->assertOk();
        $this->getJson($this->path('/records/'.$saved['id']))->assertOk()->assertJsonPath('record.data.notes', 'Poufny plan spotkania');
        $this->assertDatabaseCount('crm_records', 2);
    }

    public function test_admin_can_customize_designer_options_and_member_cannot(): void
    {
        $member = $this->member();
        $settings = app(CrmSchema::class)->defaults();
        $settings['designerCategories'][0] = ['id' => 'new', 'title' => 'Do kontaktu', 'color' => '#1144aa'];
        $settings['designerStrategies'][] = ['id' => 'materials', 'title' => 'Materiały do projektu', 'description' => 'Uzgodnij zakres materiałów.'];
        $this->auth($member)->putJson($this->path('/settings'), ['revision' => 0, 'data' => $settings])->assertForbidden();
        $admin = $this->member('admin');
        $this->auth($admin)->putJson($this->path('/settings'), ['revision' => 0, 'data' => $settings])->assertOk()->assertJsonPath('data.designerCategories.0.color', '#1144aa');
        $this->postJson($this->path('/records'), $this->input($admin, ['strategyId' => 'materials']))->assertCreated();
        $this->putJson($this->path('/settings'), ['revision' => 0, 'data' => $settings])->assertConflict();
        $stored = DB::table('crm_settings')->value('ciphertext');
        $this->assertStringNotContainsString('Materiały', $stored);
        $this->assertSame('Do kontaktu', app(CrmRecords::class)->settings(self::BOARD)['data']['designerCategories'][0]['title']);
    }

    public function test_options_reject_invalid_colors_duplicates_unknown_fields_and_empty_categories(): void
    {
        $admin = $this->member('admin');
        $this->auth($admin);
        $defaults = app(CrmSchema::class)->defaults();
        $badColor = $defaults;
        $badColor['designerCategories'][0]['color'] = 'url(https://example.test)';
        $duplicate = $defaults;
        $duplicate['designerStrategies'][] = $duplicate['designerStrategies'][0];
        $unknown = $defaults;
        $unknown['designerCategories'][0]['public'] = true;
        $empty = $defaults;
        $empty['designerCategories'] = [];
        $associative = $defaults;
        $associative['designerCategories'] = ['x' => $defaults['designerCategories'][0]];
        foreach ([$badColor, $duplicate, $unknown, $empty, $associative] as $settings) {
            $this->putJson($this->path('/settings'), ['revision' => 0, 'data' => $settings])->assertUnprocessable();
        }
        $this->assertDatabaseCount('crm_settings', 0);
    }

    public function test_used_categories_and_strategies_cannot_be_removed(): void
    {
        $admin = $this->member('admin');
        app(CrmRecords::class)->save(self::BOARD, $admin, $this->input($admin));
        $settings = app(CrmSchema::class)->defaults();
        $withoutCategory = $settings;
        array_shift($withoutCategory['designerCategories']);
        $withoutStrategy = $settings;
        $withoutStrategy['designerStrategies'] = array_values(array_filter($settings['designerStrategies'], fn ($s) => $s['id'] !== 'showroom'));
        $this->auth($admin)->putJson($this->path('/settings'), ['revision' => 0, 'data' => $withoutCategory])->assertUnprocessable()->assertJsonPath('message', 'Najpierw przenieś projektantów z usuwanej kategorii.');
        $this->putJson($this->path('/settings'), ['revision' => 0, 'data' => $withoutStrategy])->assertUnprocessable()->assertJsonPath('message', 'Najpierw zmień strategię przypisaną do projektantów.');
        $this->assertDatabaseCount('crm_settings', 0);
    }

    public function test_legacy_settings_receive_defaults_and_old_clients_preserve_custom_designer_options(): void
    {
        $admin = $this->member('admin');
        $legacy = app(CrmSchema::class)->defaults();
        unset($legacy['designerCategories'], $legacy['designerStrategies']);
        DB::table('crm_settings')->insert(['board_id' => self::BOARD, 'revision' => 4, 'ciphertext' => Crypt::encryptString(json_encode($legacy)), 'updated_at' => now()]);
        $this->auth($admin)->getJson($this->path())->assertOk()->assertJsonPath('settings.data.designerCategories.0.id', 'new');
        $custom = app(CrmRecords::class)->settings(self::BOARD)['data'];
        $custom['designerStrategies'] = [['id' => 'custom', 'title' => 'Własny plan', 'description' => 'Ustalenia zespołu']];
        $this->putJson($this->path('/settings'), ['revision' => 4, 'data' => $custom])->assertOk();
        $legacy['sources'][] = 'Wystawa';
        $this->putJson($this->path('/settings'), ['revision' => 5, 'data' => $legacy])->assertOk()->assertJsonPath('data.designerStrategies.0.id', 'custom');
        $this->assertContains('Wystawa', app(CrmRecords::class)->settings(self::BOARD)['data']['sources']);
    }

    public function test_designer_can_be_an_investment_participant_only_with_access(): void
    {
        $owner = $this->member();
        $other = $this->member();
        $designer = app(CrmRecords::class)->save(self::BOARD, $owner, $this->input($owner));
        $project = $this->input($other);
        $project['kind'] = 'project';
        $project['data'] = ['title' => 'Testowa inwestycja', 'status' => 'design', 'currency' => 'PLN', 'relationships' => [['recordId' => $designer['id'], 'role' => 'Projektant']]];
        $this->auth($other)->postJson($this->path('/records'), $project)->assertUnprocessable();
        $project['ownerId'] = $owner->id;
        $created = $this->auth($owner)->postJson($this->path('/records'), $project)->assertCreated()->json();
        $this->assertSame($designer['id'], app(CrmRecords::class)->details(self::BOARD, $created['id'], $owner)['record']['data']['relationships'][0]['recordId']);
    }

    public function test_backup_restores_designer_notes_and_custom_color_strategy_configuration(): void
    {
        Storage::fake('local');
        $disk = Storage::disk('local');
        config(['team.backup_directory' => $disk->path('backups')]);
        $admin = $this->member('admin');
        $settings = app(CrmSchema::class)->defaults();
        $settings['designerCategories'][0]['color'] = '#123456';
        app(CrmRecords::class)->saveSettings(self::BOARD, $admin, $settings, 0);
        $designer = app(CrmRecords::class)->save(self::BOARD, $admin, $this->input($admin));
        $note = ['kind' => 'activity', 'parentId' => $designer['id'], 'ownerId' => $admin->id, 'visibility' => 'team', 'accessIds' => [], 'revision' => 0, 'data' => ['title' => 'Notatka', 'type' => 'note', 'notes' => 'Ustalenia do odtworzenia']];
        $saved = app(CrmRecords::class)->save(self::BOARD, $admin, $note);
        $this->artisan('team:backup')->assertSuccessful();
        $backup = $disk->path($disk->files('backups')[0]);
        foreach (array_reverse(EncryptedBackup::TABLES) as $table) {
            DB::table($table)->delete();
        }

        $this->artisan('team:restore', ['file' => $backup])->assertSuccessful();
        $this->assertSame('showroom', app(CrmRecords::class)->details(self::BOARD, $designer['id'], $admin)['record']['data']['strategyId']);
        $this->assertSame('Ustalenia do odtworzenia', app(CrmRecords::class)->details(self::BOARD, $saved['id'], $admin)['record']['data']['notes']);
        $this->assertSame('#123456', app(CrmRecords::class)->settings(self::BOARD)['data']['designerCategories'][0]['color']);
    }
}
