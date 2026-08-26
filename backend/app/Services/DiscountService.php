<?php

namespace App\Services;

use App\Models\Discount;
use Illuminate\Validation\ValidationException;

class DiscountService
{
    public function findActive(int $id): Discount
    {
        $discount = Discount::query()->whereKey($id)->where('is_active', true)->first();
        abort_unless($discount, 422, 'Diskon tidak valid.');

        return $discount;
    }

    /**
     * @param  list<array{qty: int, price: int}>  $lines
     * @return array{item_discounts: list<int>, sale_discount: int}
     */
    public function apply(Discount $discount, array $lines, int $subtotal): array
    {
        if ($discount->min_subtotal && $subtotal < $discount->min_subtotal) {
            throw ValidationException::withMessages([
                'discount_id' => ['Subtotal belum memenuhi syarat diskon.'],
            ]);
        }

        if ($discount->scope === 'item') {
            $itemDiscounts = [];
            foreach ($lines as $line) {
                $lineSubtotal = (int) $line['qty'] * (int) $line['price'];
                $itemDiscounts[] = $this->lineAmount($discount, $lineSubtotal, false);
            }

            $total = array_sum($itemDiscounts);
            if ($discount->max_discount && $total > $discount->max_discount) {
                $itemDiscounts = $this->scaleAmounts($itemDiscounts, $discount->max_discount);
            }

            return ['item_discounts' => $itemDiscounts, 'sale_discount' => 0];
        }

        $saleDiscount = $this->lineAmount($discount, $subtotal, true);
        $itemDiscounts = array_fill(0, count($lines), 0);

        return ['item_discounts' => $itemDiscounts, 'sale_discount' => $saleDiscount];
    }

    private function lineAmount(Discount $discount, int $lineSubtotal, bool $useMaxCap): int
    {
        if ($lineSubtotal <= 0) {
            return 0;
        }

        if ($discount->value_type === 'percent') {
            $amount = (int) round($lineSubtotal * $discount->value / 100);
            if ($useMaxCap && $discount->max_discount) {
                $amount = min($amount, $discount->max_discount);
            }

            return min($amount, $lineSubtotal);
        }

        return min((int) $discount->value, $lineSubtotal);
    }

    /**
     * @param  list<int>  $amounts
     * @return list<int>
     */
    private function scaleAmounts(array $amounts, int $cap): array
    {
        $total = array_sum($amounts);
        if ($total <= 0 || $total <= $cap) {
            return $amounts;
        }

        $scaled = [];
        $remaining = $cap;
        $lastIndex = count($amounts) - 1;
        foreach ($amounts as $index => $amount) {
            if ($index === $lastIndex) {
                $scaled[] = $remaining;
                continue;
            }

            $part = (int) floor($cap * ($amount / $total));
            $scaled[] = $part;
            $remaining -= $part;
        }

        return $scaled;
    }
}
