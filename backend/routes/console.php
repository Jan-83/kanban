<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('team:backup')->dailyAt('02:20')->timezone('Europe/Warsaw')
    ->withoutOverlapping(120)->environments(['production'])
    ->appendOutputTo(storage_path('logs/backup.log'));

Schedule::command('auth:clear-resets')->daily()->withoutOverlapping();
