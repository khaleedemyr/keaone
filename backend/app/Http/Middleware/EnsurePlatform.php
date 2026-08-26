<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatform
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->is_platform) {
            return response()->json([
                'message' => 'Hanya operator platform.',
                'errors' => (object) [],
            ], 403);
        }

        return $next($request);
    }
}
