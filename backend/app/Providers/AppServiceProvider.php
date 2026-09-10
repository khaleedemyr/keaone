<?php

namespace App\Providers;

use App\Models\Sale;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Relation::morphMap([
            'sale' => Sale::class,
        ]);

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(300)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            $login = Str::lower((string) $request->input('email'));

            return Limit::perMinute(10)->by($login.'|'.$request->ip());
        });

        RateLimiter::for('register', function (Request $request) {
            return Limit::perMinute(3)->by($request->ip());
        });

        RateLimiter::for('storefront-login', function (Request $request) {
            $host = Str::lower((string) ($request->header('X-Storefront-Host') ?: $request->getHost()));
            $email = Str::lower((string) $request->input('email'));

            return Limit::perMinute(10)->by($host.'|'.$email.'|'.$request->ip());
        });

        RateLimiter::for('storefront-register', function (Request $request) {
            $host = Str::lower((string) ($request->header('X-Storefront-Host') ?: $request->getHost()));

            return Limit::perMinute(5)->by($host.'|'.$request->ip());
        });
    }
}
