<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Inventory costing (stored in companies.settings JSON)
    |--------------------------------------------------------------------------
    */

    'defaults' => [
        'inventory_costing_method' => 'moving_average',
        'inventory_allow_negative_stock' => false,
    ],

    'methods' => [
        'fifo',
        'average',
        'moving_average',
    ],

    'settings_keys' => [
        'inventory_costing_method',
        'inventory_allow_negative_stock',
    ],

];
