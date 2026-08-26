<?php

namespace App\Support;

class LangCatalog
{
    /** @var list<string> */
    public const ALL = ['id', 'en', 'es', 'ar', 'zh', 'fr', 'ja', 'ru'];

    public static function isValid(mixed $lang): bool
    {
        return is_string($lang) && in_array($lang, self::ALL, true);
    }
}
