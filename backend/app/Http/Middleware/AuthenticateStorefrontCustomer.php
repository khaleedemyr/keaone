<?php

namespace App\Http\Middleware;

use App\Models\StorefrontCustomer;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateStorefrontCustomer
{
    public function handle(Request $request, Closure $next): Response
    {
        $customer = $this->resolve($request);
        if (! $customer) {
            return response()->json(['message' => 'Silakan login terlebih dahulu.'], 401);
        }

        $request->setUserResolver(fn () => $customer);

        return $next($request);
    }

    public static function resolve(Request $request): ?StorefrontCustomer
    {
        $user = $request->user();
        if ($user instanceof StorefrontCustomer && $user->is_active) {
            return $user;
        }

        $customer = self::fromPlainToken($request->bearerToken());
        if ($customer) {
            return $customer;
        }

        // Preview checkout: staff Bearer + customer token in dedicated header.
        return self::fromPlainToken($request->header('X-Storefront-Customer-Token'));
    }

    private static function fromPlainToken(?string $plain): ?StorefrontCustomer
    {
        if (! $plain) {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($plain);
        if (! $accessToken || ! ($accessToken->tokenable instanceof StorefrontCustomer)) {
            return null;
        }

        if ($accessToken->expires_at && $accessToken->expires_at->isPast()) {
            return null;
        }

        /** @var StorefrontCustomer $customer */
        $customer = $accessToken->tokenable;
        if (! $customer->is_active) {
            return null;
        }

        $accessToken->forceFill(['last_used_at' => now()])->save();

        return $customer;
    }
}
