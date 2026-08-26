<?php

namespace App\Http\Controllers\Api\V1;

class PlatformRoleController extends RoleController
{
    protected function scope(): string
    {
        return 'platform';
    }
}
