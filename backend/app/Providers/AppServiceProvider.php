<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Gate::define('board-access', fn (User $user, string $board) => $user->active && $user->email_verified_at && DB::table('memberships')->where('board_id', $board)->where('user_id', $user->id)->exists());
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(10)->by('ip:'.$request->ip()),
            Limit::perMinutes(15, 15)->by('account:'.hash('sha256', mb_strtolower((string) $request->input('email', '')))),
        ]);
        RateLimiter::for('mfa', fn (Request $request) => [
            Limit::perMinutes(10, 8)->by('user:'.($request->user()?->id ?? $request->ip())),
            Limit::perMinute(20)->by('ip:'.$request->ip()),
        ]);
        RateLimiter::for('reset', fn (Request $request) => [
            Limit::perMinutes(15, 5)->by('ip:'.$request->ip()),
            Limit::perHour(3)->by('account:'.hash('sha256', mb_strtolower((string) $request->input('email', '')))),
        ]);
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(30)->by($request->user()?->id ?? $request->ip()));
        ResetPassword::createUrlUsing(fn (User $user, string $token) => rtrim(config('app.url'), '/').'/#reset='.rawurlencode($token).'&email='.rawurlencode($user->email));
    }
}
