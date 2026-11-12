<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public static function apply(Response $response): Response
    {
        foreach ([
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'no-referrer',
            'X-Robots-Tag' => 'noindex, nofollow, noarchive',
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=(), payment=()',
            'Cross-Origin-Resource-Policy' => 'same-origin',
            'Cross-Origin-Opener-Policy' => 'same-origin',
            'Content-Security-Policy' => "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
        ] as $key => $value) {
            $response->headers->set($key, $value);
        }
        if (app()->isProduction()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        return $response;
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (app()->isProduction()) {
            abort_unless($request->getHost() === 'team.intelispaces.pl', 400);
            if (! $request->isSecure()) {
                return redirect()->away('https://team.intelispaces.pl/', 308);
            }
        }
        abort_if((int) $request->server('CONTENT_LENGTH', 0) > 7 * 1024 * 1024, 413);

        return self::apply($next($request));
    }
}
