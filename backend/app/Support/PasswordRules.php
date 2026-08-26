<?php

namespace App\Support;

class PasswordRules
{
    public static function required(): array
    {
        return ['required', 'string', 'min:8', 'max:72'];
    }

    public static function optional(): array
    {
        return ['nullable', 'string', 'min:8', 'max:72'];
    }

    public static function confirmed(): array
    {
        return ['required', 'string', 'min:8', 'max:72', 'confirmed'];
    }
}
