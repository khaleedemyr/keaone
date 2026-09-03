<?php

namespace Tests\Unit;

use Tests\TestCase;

class InventorySettingsTest extends TestCase
{
    public function test_default_costing_method_is_moving_average(): void
    {
        $this->assertSame('moving_average', config('inventory.defaults.inventory_costing_method'));
        $this->assertSame(
            ['fifo', 'average', 'moving_average'],
            config('inventory.methods'),
        );
    }

    public function test_negative_stock_is_disallowed_by_default(): void
    {
        $this->assertFalse(config('inventory.defaults.inventory_allow_negative_stock'));
        $this->assertContains('inventory_allow_negative_stock', config('inventory.settings_keys'));
    }
}
