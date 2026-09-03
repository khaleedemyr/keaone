<?php

namespace App\Support;

class InventoryOps
{
    public const TRANSFER_REF = 'stock_transfer';

    public const OPNAME_REF = 'stock_opname';

    public const ADJUSTMENT_REF = 'stock_adjustment';

    public const PRODUCTION_REF = 'stock_production';

    public const TYPE_TRANSFER_OUT = 'transfer_out';

    public const TYPE_TRANSFER_IN = 'transfer_in';

    public const TYPE_OPNAME = 'opname';

    public const TYPE_ADJUSTMENT = 'adjustment';

    public const TYPE_PRODUCTION_ISSUE = 'production_issue';

    public const TYPE_PRODUCTION_RECEIPT = 'production_receipt';

    public const TYPE_PRODUCTION_VOID_ISSUE = 'production_void_issue';

    public const TYPE_PRODUCTION_VOID_RECEIPT = 'production_void_receipt';

    /** @return list<string> */
    public static function defaultProductionSteps(): array
    {
        return ['Prepare', 'Produce', 'QC', 'Complete'];
    }

    /** @return list<string> */
    public static function adjustmentReasons(): array
    {
        return [
            'damage',
            'loss',
            'sample',
            'write_off',
            'found',
            'other',
            'expired',
            'overcook',
            'complimentary',
        ];
    }

    /** @return list<string> */
    public static function wasteReasons(): array
    {
        return ['expired', 'overcook', 'complimentary', 'damage', 'write_off'];
    }

    public static function isWasteReason(string $reason): bool
    {
        return in_array($reason, self::wasteReasons(), true);
    }

    /** @return list<string> */
    public static function warehouseLocationTypes(): array
    {
        return ['general', 'dry', 'chiller', 'freezer', 'bar', 'other'];
    }
}
