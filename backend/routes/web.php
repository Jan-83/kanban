<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\CrmController;
use App\Http\Controllers\CrmFileController;
use App\Http\Controllers\ImageController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response(file_get_contents(public_path('spa.html')), 200, ['Content-Type' => 'text/html; charset=UTF-8']));
Route::prefix('api')->group(function (): void {
    Route::get('/session', [AuthController::class, 'session']);
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login')->block();
    Route::post('/logout', [AuthController::class, 'logout'])->block();
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:reset')->block();
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:reset')->block();
    Route::middleware('identity')->group(function (): void {
        Route::post('/mfa/setup', [AuthController::class, 'setup'])->middleware('throttle:mfa')->block();
        Route::post('/mfa/confirm', [AuthController::class, 'confirmSetup'])->middleware('throttle:mfa')->block();
        Route::post('/mfa/challenge', [AuthController::class, 'challenge'])->middleware('throttle:mfa')->block();
        Route::middleware('mfa')->prefix('/boards/{board}')->whereUuid('board')->group(function (): void {
            Route::prefix('crm')->middleware('throttle:120,1')->group(function (): void {
                Route::get('/', [CrmController::class, 'index']);
                Route::post('/records', [CrmController::class, 'store'])->block();
                Route::get('/records/{record}', [CrmController::class, 'show'])->whereUuid('record');
                Route::put('/records/{record}', [CrmController::class, 'update'])->whereUuid('record')->block();
                Route::delete('/records/{record}', [CrmController::class, 'destroy'])->whereUuid('record')->block();
                Route::post('/records/{record}/version', [CrmController::class, 'version'])->whereUuid('record')->block();
                Route::post('/records/{record}/task', [CrmController::class, 'task'])->whereUuid('record')->block();
                Route::put('/settings', [CrmController::class, 'settings'])->block();
                Route::post('/notifications/read', [CrmController::class, 'notifications'])->block();
                Route::post('/records/{record}/files', [CrmFileController::class, 'store'])->whereUuid('record')->middleware('throttle:uploads')->block();
                Route::get('/files/{file}', [CrmFileController::class, 'show'])->whereUuid('file');
                Route::delete('/files/{file}', [CrmFileController::class, 'destroy'])->whereUuid('file')->block();
            });
            Route::get('/images/content', [ImageController::class, 'show']);
            Route::post('/images', [ImageController::class, 'store'])->middleware('throttle:uploads')->block();
            Route::post('/images/copy', [ImageController::class, 'copy'])->middleware('throttle:uploads')->block();
            Route::get('/{kind}', [BoardController::class, 'show'])->whereIn('kind', ['kanban', 'strategy']);
            Route::put('/{kind}', [BoardController::class, 'update'])->whereIn('kind', ['kanban', 'strategy'])->block();
        });
    });
});
