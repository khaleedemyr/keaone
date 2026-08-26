<?php

namespace App\Http\Controllers\Api\V1;

class SupplierController extends TypedContactController
{
    protected function menuKey(): string
    {
        return 'suppliers';
    }

    protected function contactType(): string
    {
        return 'supplier';
    }
}
