<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('activity-logs:prune')->dailyAt('03:30');
        $schedule->command('notifications:prune')->dailyAt('03:45');
        $schedule->command('chat:prune')->weeklyOn(0, '04:00');
        $schedule->command('partitions:ensure')->monthlyOn(1, '02:00');
        $schedule->command('procurement:escalate-approvals')->hourly();
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
        $middleware->api(append: [
            \App\Http\Middleware\RecordActivity::class,
        ]);
        $middleware->throttleApi();
        $middleware->alias([
            'company' => \App\Http\Middleware\EnsureCompany::class,
            'platform' => \App\Http\Middleware\EnsurePlatform::class,
            'sse.auth' => \App\Http\Middleware\AuthenticateEventStream::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'Terlalu banyak percobaan. Coba lagi sebentar.',
                    'errors' => (object) [],
                ], 429);
            }

            return null;
        });
    })->create();
