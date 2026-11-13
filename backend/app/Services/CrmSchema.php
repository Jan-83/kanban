<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;

class CrmSchema
{
    public const KINDS = ['company', 'contact', 'designer', 'project', 'deal', 'activity', 'followup', 'event', 'offer', 'service', 'rule'];

    public function defaults(): array
    {
        return ['stages' => [
            ['id' => 'new', 'title' => 'Nowy kontakt', 'probability' => 10, 'color' => '#8b8fa3', 'outcome' => 'open'],
            ['id' => 'qualified', 'title' => 'Rozpoznanie', 'probability' => 30, 'color' => '#6e64e8', 'outcome' => 'open'],
            ['id' => 'proposal', 'title' => 'Oferta', 'probability' => 60, 'color' => '#e4a04c', 'outcome' => 'open'],
            ['id' => 'negotiation', 'title' => 'Ustalenia', 'probability' => 80, 'color' => '#3596ba', 'outcome' => 'open'],
            ['id' => 'won', 'title' => 'Wygrana', 'probability' => 100, 'color' => '#2e9d79', 'outcome' => 'won'],
            ['id' => 'lost', 'title' => 'Przegrana', 'probability' => 0, 'color' => '#c77781', 'outcome' => 'lost'],
        ], 'categories' => ['Inwestor', 'Architekt', 'Projektant', 'Instalator', 'Integrator', 'Deweloper'],
            'sources' => ['Polecenie', 'Strona internetowa', 'Telefon', 'E-mail', 'Targi', 'Partner', 'Kampania reklamowa'],
            'designerCategories' => [
                ['id' => 'new', 'title' => 'Do poznania', 'color' => '#748094'],
                ['id' => 'conversation', 'title' => 'W rozmowie', 'color' => '#7464dd'],
                ['id' => 'potential', 'title' => 'Duży potencjał', 'color' => '#c18a29'],
                ['id' => 'partner', 'title' => 'Współpraca', 'color' => '#27856d'],
                ['id' => 'paused', 'title' => 'Wstrzymane', 'color' => '#b85b75'],
            ],
            'designerStrategies' => [
                ['id' => 'first_contact', 'title' => 'Pierwszy kontakt', 'description' => 'Poznaj pracownię, typy projektów i potrzeby projektanta.'],
                ['id' => 'showroom', 'title' => 'Zaproszenie do showroomu', 'description' => 'Zaproponuj spotkanie i pokaz rozwiązań na żywo.'],
                ['id' => 'knx_presentation', 'title' => 'Prezentacja KNX', 'description' => 'Pokaż sceny, sterowanie i korzyści dla inwestora.'],
                ['id' => 'project_support', 'title' => 'Wsparcie konkretnego projektu', 'description' => 'Pomóż dobrać rozwiązania do aktualnej inwestycji.'],
                ['id' => 'partnership', 'title' => 'Oferta współpracy', 'description' => 'Ustal model współpracy i wzajemne oczekiwania.'],
                ['id' => 'relationship', 'title' => 'Rozwijanie relacji', 'description' => 'Wracaj z inspiracjami, materiałami i wsparciem kolejnych realizacji.'],
            ]];
    }

    public function settings(array $data): array
    {
        $this->keys($data, ['stages', 'categories', 'sources', 'designerCategories', 'designerStrategies']);
        $validated = Validator::make($data, [
            'stages' => ['required', 'array', 'min:3', 'max:16'], 'stages.*' => ['array:id,title,probability,color,outcome'],
            'stages.*.id' => ['required', 'string', 'regex:/^[a-z0-9_-]{1,40}$/D', 'distinct'],
            'stages.*.title' => ['required', 'string', 'max:60'], 'stages.*.probability' => ['required', 'integer:strict', 'between:0,100'],
            'stages.*.color' => ['required', 'regex:/^#[a-f0-9]{6}$/iD'], 'stages.*.outcome' => ['required', 'in:open,won,lost'],
            'categories' => ['required', 'array', 'max:60'], 'categories.*' => ['required', 'string', 'max:80', 'distinct'],
            'sources' => ['required', 'array', 'max:60'], 'sources.*' => ['required', 'string', 'max:80', 'distinct'],
            'designerCategories' => ['required', 'array', 'list', 'min:1', 'max:16'],
            'designerCategories.*' => ['required', 'array:id,title,color'],
            'designerCategories.*.id' => ['required', 'string', 'regex:/^[a-z0-9_-]{1,40}$/D', 'distinct'],
            'designerCategories.*.title' => ['required', 'string', 'max:60', 'distinct'],
            'designerCategories.*.color' => ['required', 'regex:/^#[a-f0-9]{6}$/iD'],
            'designerStrategies' => ['present', 'array', 'list', 'max:40'],
            'designerStrategies.*' => ['required', 'array:id,title,description'],
            'designerStrategies.*.id' => ['required', 'string', 'regex:/^[a-z0-9_-]{1,40}$/D', 'distinct'],
            'designerStrategies.*.title' => ['required', 'string', 'max:80', 'distinct'],
            'designerStrategies.*.description' => ['sometimes', 'nullable', 'string', 'max:500'],
        ])->validate();
        abort_unless(array_diff(['open', 'won', 'lost'], array_column($validated['stages'], 'outcome')) === [], 422, 'Potrzebne są etapy otwarty, wygrany i przegrany.');
        foreach ($validated['stages'] as &$stage) {
            if ($stage['outcome'] !== 'open') {
                $stage['probability'] = $stage['outcome'] === 'won' ? 100 : 0;
            }
        }

        return $validated;
    }

    public function payload(string $kind, array $data, array $settings): array
    {
        abort_unless(in_array($kind, self::KINDS, true), 422);
        abort_if(strlen(json_encode($data, JSON_THROW_ON_ERROR)) > 64000, 422, 'Rekord przekracza 64 KB.');
        $text = ['sometimes', 'string', 'max:300'];
        $short = ['sometimes', 'string', 'max:100'];
        $date = ['sometimes', 'nullable', 'date_format:Y-m-d'];
        $datetime = ['sometimes', 'nullable', 'date_format:Y-m-d\TH:i:sP'];
        $money = ['sometimes', 'integer:strict', 'between:0,999999999999'];
        $user = ['sometimes', 'nullable', 'uuid'];
        $rules = ['title' => ['required', 'string', 'max:200'], 'notes' => ['sometimes', 'string', 'max:20000'],
            'tags' => ['sometimes', 'array', 'max:20'], 'tags.*' => ['required', 'string', 'max:60', 'distinct']];
        $specific = match ($kind) {
            'designer' => ['categoryId' => ['required', 'string', 'in:'.implode(',', array_column($settings['designerCategories'], 'id'))],
                'strategyId' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', array_column($settings['designerStrategies'], 'id'))],
                'studio' => $text, 'specialization' => $text, 'email' => ['sometimes', 'string', 'email', 'max:254'], 'phone' => $short,
                'address' => $text, 'city' => $short, 'website' => ['sometimes', 'string', 'url:https,http', 'max:500'], 'source' => $short],
            'company' => ['category' => $short, 'nip' => ['sometimes', 'string', 'max:24'], 'email' => ['sometimes', 'string', 'email', 'max:254'], 'phone' => $short,
                'address' => $text, 'city' => $short, 'website' => ['sometimes', 'string', 'url:https,http', 'max:500'], 'industry' => $short, 'source' => $short],
            'contact' => ['category' => $short, 'jobTitle' => $short, 'email' => ['sometimes', 'string', 'email', 'max:254'], 'phone' => $short, 'source' => $short],
            'project' => ['type' => $short, 'status' => ['required', 'in:planning,design,construction,installation,commissioning,complete'],
                'address' => $text, 'city' => $short, 'valueCents' => $money, 'currency' => ['required', 'in:PLN,EUR,USD'], 'area' => ['sometimes', 'numeric', 'between:0,10000000'],
                'startDate' => $date, 'dueDate' => $date, 'systems' => ['sometimes', 'array', 'max:20'], 'systems.*' => ['required', 'string', 'max:80', 'distinct'],
                'relationships' => ['sometimes', 'array', 'max:80'], 'relationships.*' => ['array:recordId,role'],
                'relationships.*.recordId' => ['required', 'uuid', 'distinct'], 'relationships.*.role' => ['required', 'string', 'max:80']],
            'deal' => ['stageId' => ['required', 'string', 'in:'.implode(',', array_column($settings['stages'], 'id'))],
                'valueCents' => $money, 'currency' => ['required', 'in:PLN,EUR,USD'], 'expectedDate' => $date, 'source' => $short, 'lostReason' => $text],
            'activity' => ['type' => ['required', 'in:note,call,meeting,email'], 'occurredAt' => $datetime,
                'outlookUrl' => ['sometimes', 'string', 'max:2000', function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value !== '' && (parse_url($value, PHP_URL_SCHEME) !== 'https' || ! in_array(parse_url($value, PHP_URL_HOST), ['outlook.office.com', 'outlook.office365.com', 'outlook.live.com'], true)
                        || parse_url($value, PHP_URL_USER) !== null || parse_url($value, PHP_URL_PORT) !== null)) {
                        $fail('Użyj bezpośredniego linku HTTPS do wiadomości w Outlooku.');
                    }
                }]],
            'followup' => ['type' => ['required', 'in:call,email,meeting,task'], 'status' => ['required', 'in:open,done'], 'dueAt' => $datetime,
                'assigneeId' => $user, 'priority' => ['required', 'in:low,medium,high,urgent'], 'reminderMinutes' => ['sometimes', 'integer:strict', 'between:0,10080']],
            'event' => ['type' => ['required', 'in:meeting,visit,presentation,deadline'], 'startsAt' => ['required', 'date_format:Y-m-d\TH:i:sP'],
                'endsAt' => ['required', 'date_format:Y-m-d\TH:i:sP', 'after:startsAt'], 'location' => $text, 'participants' => $text,
                'assigneeId' => $user, 'reminderMinutes' => ['sometimes', 'integer:strict', 'between:0,10080']],
            'offer' => ['number' => ['required', 'string', 'max:100'], 'valueCents' => $money, 'currency' => ['required', 'in:PLN,EUR,USD'],
                'status' => ['required', 'in:draft,sent,accepted,rejected,expired'], 'validUntil' => $date],
            'service' => ['type' => ['required', 'in:ticket,warranty,inspection,expansion'], 'status' => ['required', 'in:new,in_progress,waiting,closed'],
                'priority' => ['required', 'in:low,medium,high,urgent'], 'assigneeId' => $user, 'dueAt' => $datetime, 'warrantyUntil' => $date, 'nextInspectionDate' => $date, 'resolution' => ['sometimes', 'string', 'max:10000']],
            'rule' => ['enabled' => ['required', 'boolean:strict'], 'trigger' => ['required', 'in:offer_sent,stage_changed,inactive'],
                'stageId' => $short, 'days' => ['required', 'integer:strict', 'between:1,365'], 'delayDays' => ['required', 'integer:strict', 'between:0,365'],
                'action' => ['required', 'in:followup,notice'], 'assigneeId' => $user, 'taskType' => ['required', 'in:call,email,meeting,task']],
        };
        $this->keys($data, array_merge(array_keys($rules), array_keys($specific)));

        $validated = Validator::make($data, array_merge($rules, $specific))->validate();
        if ($kind === 'rule' && $validated['trigger'] === 'stage_changed') {
            abort_unless(in_array($validated['stageId'] ?? '', array_column($settings['stages'], 'id'), true), 422, 'Wybierz etap wyzwalający regułę.');
        }
        foreach (['tags', 'systems', 'relationships'] as $field) {
            abort_if(isset($validated[$field]) && ! array_is_list($validated[$field]), 422, 'Nieprawidłowy format listy.');
        }

        return $validated;
    }

    public function keys(array $data, array $allowed): void
    {
        abort_unless(array_diff(array_keys($data), array_filter($allowed, fn ($key) => ! str_contains($key, '.'))) === [], 422, 'Formularz zawiera nieobsługiwane pola.');
    }
}
