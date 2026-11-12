<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RequireIdentity
{
    public static function valid(Request $request): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }
        $session = $request->session();
        $now = now()->timestamp;
        $pending = ! $session->get('mfa_verified');

        return $user->active && $user->email_verified_at
            && $session->get('auth_version') === $user->auth_version
            && $now - (int) $session->get('password_at', 0) <= ($pending ? 600 : config('team.max_session_seconds'))
            && $now - (int) $session->get('seen_at', 0) <= config('team.idle_seconds');
    }

    public static function clear(Request $request): void
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (! self::valid($request)) {
            self::clear($request);
            abort(401, 'Sesja wygasła. Zaloguj się ponownie.');
        }
        if ($request->header('X-User-Active') === '1' || ! $request->isMethod('GET')) {
            $request->session()->put('seen_at', now()->timestamp);
        }

        return $next($request);
    }
}
