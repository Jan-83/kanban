<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StrictCsrf
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            $origin = $request->header('Origin');
            $expected = app()->isProduction() ? 'https://team.intelispaces.pl' : $request->getSchemeAndHttpHost();
            abort_if($origin !== null && $origin !== $expected, 403, 'Niedozwolone źródło żądania.');
            abort_unless(is_string($request->header('X-CSRF-TOKEN'))
                && hash_equals($request->session()->token(), $request->header('X-CSRF-TOKEN')), 419);
        }

        return $next($request);
    }
}
