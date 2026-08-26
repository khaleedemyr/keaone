<?php

namespace App\Http\Controllers\Api\V1;

class CustomerController extends TypedContactController
{
    protected function menuKey(): string
    {
        return 'customers';
    }

    protected function contactType(): string
    {
        return 'customer';
    }
}
