<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * EventSource cannot send Authorization / X-Company-Id headers — accept them via query string.
 */
class AuthenticateEventStream
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->query('company_id') && ! $request->header('X-Company-Id')) {
            $request->headers->set('X-Company-Id', (string) $request->query('company_id'));
        }

        if ($request->user()) {
            return $next($request);
        }

        $token = $request->query('access_token');
        if (! is_string($token) || $token === '') {
            abort(401, 'Unauthorized');
        }

        $accessToken = PersonalAccessToken::findToken($token);
        if (! $accessToken) {
            abort(401, 'Unauthorized');
        }

        if ($accessToken->expires_at && $accessToken->expires_at->isPast()) {
            abort(401, 'Token expired');
        }

        $user = $accessToken->tokenable;
        if (! $user) {
            abort(401, 'Unauthorized');
        }

        $request->setUserResolver(static fn () => $user);
        auth()->setUser($user);

        return $next($request);
    }
}
