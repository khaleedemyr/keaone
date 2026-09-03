<?php

namespace Tests\Unit;

use App\Support\InventoryOps;
use App\Support\MenuCatalog;
use Tests\TestCase;

class InventoryOpsTest extends TestCase
{
    public function test_movement_ref_and_type_constants(): void
    {
        $this->assertSame('stock_transfer', InventoryOps::TRANSFER_REF);
        $this->assertSame('stock_opname', InventoryOps::OPNAME_REF);
        $this->assertSame('stock_adjustment', InventoryOps::ADJUSTMENT_REF);
        $this->assertSame('transfer_out', InventoryOps::TYPE_TRANSFER_OUT);
        $this->assertSame('transfer_in', InventoryOps::TYPE_TRANSFER_IN);
        $this->assertSame('opname', InventoryOps::TYPE_OPNAME);
        $this->assertSame('adjustment', InventoryOps::TYPE_ADJUSTMENT);
    }

    public function test_adjustment_reasons(): void
    {
        $this->assertSame(
            ['damage', 'loss', 'sample', 'write_off', 'found', 'other', 'expired', 'overcook', 'complimentary'],
            InventoryOps::adjustmentReasons(),
        );
        $this->assertSame(
            ['expired', 'overcook', 'complimentary', 'damage', 'write_off'],
            InventoryOps::wasteReasons(),
        );
        $this->assertTrue(InventoryOps::isWasteReason('expired'));
        $this->assertFalse(InventoryOps::isWasteReason('found'));
    }

    public function test_menu_catalog_includes_phase1_ops(): void
    {
        $keys = array_column(MenuCatalog::tenant(), 'key');

        $this->assertContains('stocktransfers', $keys);
        $this->assertContains('stockopnames', $keys);
        $this->assertContains('stockadjustments', $keys);
    }

    public function test_menu_catalog_includes_phase2_valuation(): void
    {
        $keys = array_column(MenuCatalog::tenant(), 'key');

        $this->assertContains('stockvaluation', $keys);
    }

    public function test_menu_catalog_includes_phase3_cafe_ops(): void
    {
        $keys = array_column(MenuCatalog::tenant(), 'key');

        $this->assertContains('stockwaste', $keys);
        $this->assertContains('stockproduction', $keys);
        $this->assertSame('stock_production', InventoryOps::PRODUCTION_REF);
        $this->assertSame(
            ['general', 'dry', 'chiller', 'freezer', 'bar', 'other'],
            InventoryOps::warehouseLocationTypes(),
        );
    }

    public function test_phase5b_production_void_and_routing_constants(): void
    {
        $this->assertSame('production_void_issue', InventoryOps::TYPE_PRODUCTION_VOID_ISSUE);
        $this->assertSame('production_void_receipt', InventoryOps::TYPE_PRODUCTION_VOID_RECEIPT);
        $this->assertSame(
            ['Prepare', 'Produce', 'QC', 'Complete'],
            InventoryOps::defaultProductionSteps(),
        );
    }
}
