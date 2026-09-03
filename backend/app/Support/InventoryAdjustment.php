<?php

namespace App\Support;

class InventoryAdjustment
{
    public function __construct(
        public readonly int $qtyAfter,
        public readonly int $unitCost,
        public readonly int $costAmount,
        public readonly string $method,
    ) {}
}
