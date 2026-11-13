<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\CrmRecords;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class CrmDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') || DB::getDriverName() !== 'sqlite' || DB::table('users')->exists()) {
            throw new \RuntimeException('Demo seeding requires an empty local SQLite database.');
        }
        $board = config('team.board_id');
        $user = User::factory()->create(['name' => 'Jan Demo', 'email' => 'crm-demo@example.test', 'password' => Hash::make('Local-demo-only-2026!'),
            'mfa_secret' => 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', 'mfa_confirmed_at' => now()])->refresh();
        DB::table('boards')->insert(['id' => $board, 'name' => Crypt::encryptString('Fikcyjne dane demonstracyjne'), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('memberships')->insert(['board_id' => $board, 'user_id' => $user->id, 'display_name' => 'Jan Demo', 'role' => 'admin']);
        DB::table('documents')->insert(['board_id' => $board, 'kind' => 'kanban', 'revision' => 1,
            'ciphertext' => Crypt::encryptString(json_encode(['tasks' => [], 'members' => [], 'stages' => [
                ['id' => 'todo', 'title' => 'Do zrobienia', 'color' => '#64748b'], ['id' => 'in_progress', 'title' => 'W toku', 'color' => '#d97706'], ['id' => 'done', 'title' => 'Gotowe', 'color' => '#0d9488'],
            ]])), 'updated_at' => now()]);
        DB::table('documents')->insert(['board_id' => $board, 'kind' => 'strategy', 'revision' => 1, 'ciphertext' => Crypt::encryptString('{"version":2,"cards":[]}'), 'updated_at' => now()]);
        $crm = app(CrmRecords::class);
        $create = fn (string $kind, array $data, ?string $parent = null) => $crm->save($board, $user, ['kind' => $kind, 'parentId' => $parent, 'ownerId' => $user->id,
            'visibility' => 'team', 'accessIds' => [], 'revision' => 0, 'data' => $data]);
        foreach ([
            ['Anna Demo', 'Jasna Forma — demo', 'Warszawa', 'new', null],
            ['Piotr Przykładowy', 'Pracownia Północ — demo', 'Łódź', 'new', 'first_contact'],
            ['Julia Testowa', 'Studio Perspektywa — demo', 'Kraków', 'conversation', 'showroom'],
            ['Michał Wzorcowy', 'Forma i Światło — demo', 'Warszawa', 'potential', 'project_support'],
            ['Ewa Demonstracyjna', 'Prosta Linia — demo', 'Gdańsk', 'partner', 'relationship'],
        ] as [$title, $studio, $city, $category, $strategy]) {
            $designer = $create('designer', ['title' => $title, 'studio' => $studio, 'city' => $city, 'categoryId' => $category, 'strategyId' => $strategy,
                'email' => 'projektant@example.test', 'phone' => '+48 000 000 000', 'specialization' => 'Wnętrza mieszkalne', 'notes' => 'Fikcyjny kontakt do testów tablicy.']);
            if ($strategy) {
                $create('activity', ['title' => 'Ustalenia demonstracyjne', 'type' => 'note', 'notes' => 'Omówiliśmy kierunek współpracy. Kolejny krok: wspólna prezentacja rozwiązań.', 'occurredAt' => now()->format('Y-m-d\TH:i:sP')], $designer['id']);
            }
        }
        $companies = [];
        foreach ([['Forma Studio', 'Architekt', 'Warszawa'], ['Przestrzeń Development', 'Deweloper', 'Kraków'], ['Marta Nowicka', 'Inwestor', 'Konstancin'], ['Nord Interior', 'Projektant', 'Gdańsk']] as [$title, $category, $city]) {
            $companies[] = $create('company', ['title' => $title, 'category' => $category, 'city' => $city, 'email' => 'demo@example.test', 'source' => 'Polecenie', 'notes' => 'Dane fikcyjne do testów interfejsu.']);
        }
        $contact = $create('contact', ['title' => 'Anna Nowak', 'jobTitle' => 'Architekt prowadzący', 'category' => 'Architekt', 'email' => 'anna@example.test'], $companies[0]['id']);
        $project = $create('project', ['title' => 'Rezydencja Parkowa', 'status' => 'design', 'currency' => 'PLN', 'valueCents' => 12800000, 'city' => 'Konstancin', 'type' => 'Dom', 'systems' => ['KNX', 'AV', 'Sterowanie światłem'], 'relationships' => [['recordId' => $contact['id'], 'role' => 'Architekt'], ['recordId' => $companies[2]['id'], 'role' => 'Inwestor']]], $companies[2]['id']);
        foreach ([['Rezydencja Parkowa · KNX', 'proposal', 12800000, 2], ['Biuro przyszłości · AV', 'qualified', 7600000, 1], ['Apartament nad morzem', 'negotiation', 4200000, 3], ['Showroom · JUNG HOME', 'new', 2800000, 0], ['Dom wśród drzew', 'won', 9600000, 2], ['Hotel · modernizacja', 'qualified', 16400000, 1]] as [$title, $stage, $value, $client]) {
            $create('deal', ['title' => $title, 'stageId' => $stage, 'currency' => 'PLN', 'valueCents' => $value, 'source' => $client % 2 ? 'Strona internetowa' : 'Polecenie', 'expectedDate' => now()->addDays(12)->format('Y-m-d')], $companies[$client]['id']);
        }
        foreach ([['Omówić warianty sterowania światłem', 0], ['Przesłać koncepcję instalacji', 1], ['Zadzwonić po prezentacji', -1], ['Ustalić termin wizji lokalnej', 2]] as [$title, $days]) {
            $create('followup', ['title' => $title, 'type' => 'call', 'status' => 'open', 'priority' => 'medium', 'assigneeId' => $user->id, 'dueAt' => now()->addDays($days)->format('Y-m-d\TH:i:sP'), 'reminderMinutes' => 30], $project['id']);
        }
        $create('event', ['title' => 'Wizja lokalna · Rezydencja Parkowa', 'type' => 'visit', 'startsAt' => now()->addDay()->setTime(10, 0)->format('Y-m-d\TH:i:sP'), 'endsAt' => now()->addDay()->setTime(11, 0)->format('Y-m-d\TH:i:sP'), 'location' => 'Konstancin', 'assigneeId' => $user->id], $project['id']);
        $create('offer', ['title' => 'Automatyka KNX — wariant rozszerzony', 'number' => 'DEMO/2026/041', 'status' => 'sent', 'currency' => 'PLN', 'valueCents' => 12800000, 'validUntil' => now()->addDays(14)->format('Y-m-d')], $project['id']);
        foreach (['Omówione potrzeby inwestora', 'Wybrane wykończenia i sceny światła', 'Potwierdzony zakres pierwszego etapu'] as $title) {
            $create('activity', ['title' => $title, 'type' => 'meeting', 'occurredAt' => now()->subHours(2)->format('Y-m-d\TH:i:sP'), 'notes' => 'Fikcyjne ustalenia do weryfikacji osi czasu.'], $project['id']);
        }
        $create('service', ['title' => 'Przegląd instalacji po uruchomieniu', 'type' => 'inspection', 'status' => 'new', 'priority' => 'medium', 'assigneeId' => $user->id, 'nextInspectionDate' => now()->addMonth()->format('Y-m-d')], $project['id']);
        $create('rule', ['title' => 'Kontakt po wysłaniu oferty', 'enabled' => true, 'trigger' => 'offer_sent', 'days' => 14, 'delayDays' => 3, 'action' => 'followup', 'taskType' => 'call']);
    }
}
