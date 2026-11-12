<?php

use App\Http\Middleware\RequireIdentity;
use App\Http\Middleware\RequireMfa;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\StrictCsrf;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', commands: __DIR__.'/../routes/console.php')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trimStrings(except: [fn (Request $request) => $request->is('api/boards/*')]);
        $middleware->convertEmptyStringsToNull(except: [fn (Request $request) => $request->is('api/boards/*')]);
        $middleware->append(SecurityHeaders::class);
        $middleware->web(append: [StrictCsrf::class]);
        $middleware->alias(['identity' => RequireIdentity::class, 'mfa' => RequireMfa::class]);
        $middleware->redirectGuestsTo('/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*'));
        $exceptions->respond(fn (Response $response) => SecurityHeaders::apply($response));
        $exceptions->dontFlash(['password', 'password_confirmation', 'code', 'recovery', 'token', 'secret']);
    })->create();
