<?php

namespace App\Http\Middleware;

use App\Services\ActivityLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RecordActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $this->shouldRecord($request, $response)) {
            return $response;
        }

        ActivityLogger::fromRequest($request, $response->getStatusCode());

        return $response;
    }

    private function shouldRecord(Request $request, Response $response): bool
    {
        if (! $request->is('api/v1/*')) {
            return false;
        }

        $method = strtoupper($request->method());
        if (! in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return false;
        }

        $status = $response->getStatusCode();
        if ($status < 200 || $status >= 300) {
            return false;
        }

        $path = preg_replace('#^api/v1/#', '', trim($request->path(), '/'));

        if (str_starts_with($path, 'activity-logs')) {
            return false;
        }

        if (in_array($path, ['auth/login', 'auth/register', 'catalog'], true)) {
            return false;
        }

        return true;
    }
}
