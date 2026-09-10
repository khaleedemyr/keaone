<?php

return [

    /*
    |--------------------------------------------------------------------------
    | RajaOngkir (Komerce) API
    |--------------------------------------------------------------------------
    |
    | Platform-level API key used when a storefront does not set its own key.
    | Get a key from https://rajaongkir.com / https://komerce.id
    |
    */

    'base_url' => rtrim((string) env('RAJAONGKIR_BASE_URL', 'https://rajaongkir.komerce.id/api/v1'), '/'),

    'api_key' => env('RAJAONGKIR_API_KEY', ''),

    'timeout' => (int) env('RAJAONGKIR_TIMEOUT', 20),

    'default_couriers' => ['jne', 'sicepat', 'jnt', 'tiki', 'pos'],

    'default_weight_gram' => (int) env('RAJAONGKIR_DEFAULT_WEIGHT_GRAM', 500),

];
