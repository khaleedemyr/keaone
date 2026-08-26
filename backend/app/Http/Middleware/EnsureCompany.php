<?php

namespace App\Http\Middleware;

use App\Support\CurrentCompany;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        $company = CurrentCompany::company($request->user());

        if (! $company) {
            return response()->json([
                'message' => 'Tidak terhubung ke perusahaan.',
                'errors' => (object) [],
            ], 403);
        }

        if ($company->status !== 'active' && ! CurrentCompany::isPlatform($request->user())) {
            return response()->json([
                'message' => 'Perusahaan ini dinonaktifkan.',
                'errors' => (object) [],
            ], 403);
        }

        return $next($request);
    }
}
