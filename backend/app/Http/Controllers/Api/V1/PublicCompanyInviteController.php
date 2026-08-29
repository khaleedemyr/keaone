<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\CompanyInviteService;
use Illuminate\Http\JsonResponse;

class PublicCompanyInviteController extends Controller
{
    public function __construct(private CompanyInviteService $invites) {}

    public function show(string $token): JsonResponse
    {
        $invite = $this->invites->findByToken($token);

        return $this->ok($this->invites->serializePublic($invite));
    }
}
