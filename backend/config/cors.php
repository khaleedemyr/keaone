<?php

$frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/');
$app = rtrim((string) env('APP_URL', 'http://localhost:8000'), '/');

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'media/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_values(array_unique(array_filter([$frontend, $app]))),

    'allowed_origins_patterns' => [
        '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#',
    ],

    'allowed_headers' => ['Authorization', 'Content-Type', 'Accept', 'X-Company-Id', 'X-Requested-With'],

    'exposed_headers' => [],

    'max_age' => 600,

    'supports_credentials' => false,
];
