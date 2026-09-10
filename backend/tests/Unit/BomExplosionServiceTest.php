<?php

namespace Tests\Unit;

use App\Services\BomExplosionService;
use App\Support\ModuleCatalog;
use Tests\TestCase;

class BomExplosionServiceTest extends TestCase
{
    public function test_module_catalog_includes_work_order_default_off(): void
    {
        $this->assertContains('work_order', ModuleCatalog::keys());
        $this->assertFalse(ModuleCatalog::defaults()['work_order']);
    }

    public function test_module_catalog_includes_finance_default_on(): void
    {
        $this->assertContains('finance', ModuleCatalog::keys());
        $this->assertTrue(ModuleCatalog::defaults()['finance']);
    }

    public function test_module_catalog_includes_storefront_default_off(): void
    {
        $this->assertContains('storefront', ModuleCatalog::keys());
        $this->assertFalse(ModuleCatalog::defaults()['storefront']);
    }

    public function test_explode_flat_requires_positive_qty(): void
    {
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(BomExplosionService::class)->explodeFlat(1, 1, 0);
    }

    public function test_explode_leaves_requires_positive_qty(): void
    {
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(BomExplosionService::class)->explodeLeaves(1, 1, 0);
    }
}
