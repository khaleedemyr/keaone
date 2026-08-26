<?php

namespace App\Services;

use App\Models\Promotion;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class PromotionService
{
    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     */
    public function findActive(int $id): Promotion
    {
        $promotion = Promotion::query()
            ->with(['products', 'categories'])
            ->whereKey($id)
            ->where('is_active', true)
            ->first();
        abort_unless($promotion, 422, 'Promo tidak valid.');

        return $promotion;
    }

    public function findByCode(string $code): Promotion
    {
        $promotion = Promotion::query()
            ->with(['products', 'categories'])
            ->where('code', $code)
            ->where('is_active', true)
            ->first();
        abort_unless($promotion, 422, 'Kode promo tidak valid.');

        return $promotion;
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     * @return array{item_discounts: list<int>, sale_discount: int}
     */
    public function apply(Promotion $promotion, array $lines, int $subtotal, ?Carbon $at = null): array
    {
        if (! $this->isEligible($promotion, $lines, $subtotal, $at)) {
            throw ValidationException::withMessages([
                'promotion_id' => ['Promo tidak memenuhi syarat.'],
            ]);
        }

        return match ($promotion->type) {
            'bogo' => $this->applyBogo($promotion, $lines),
            'bundle' => $this->applyBundle($promotion, $lines),
            default => $this->applySimple($promotion, $lines, $subtotal),
        };
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     */
    public function isEligible(Promotion $promotion, array $lines, int $subtotal, ?Carbon $at = null): bool
    {
        $at ??= now();

        if ($promotion->starts_at && $at->lt($promotion->starts_at)) {
            return false;
        }
        if ($promotion->ends_at && $at->gt($promotion->ends_at)) {
            return false;
        }
        if ($promotion->min_subtotal && $subtotal < $promotion->min_subtotal) {
            return false;
        }

        if ($promotion->type === 'bundle') {
            return $this->bundleCount($promotion, $lines) > 0;
        }

        if ($promotion->type === 'bogo') {
            return $this->bogoSetsAvailable($promotion, $lines) > 0;
        }

        if ($promotion->products->isNotEmpty() || $promotion->categories->isNotEmpty()) {
            return count($this->eligibleIndexes($promotion, $lines)) > 0;
        }

        return true;
    }

    /**
     * @param  iterable<Promotion>  $promotions
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     */
    public function bestAutoApply(iterable $promotions, array $lines, int $subtotal, ?Carbon $at = null): ?Promotion
    {
        $at ??= now();
        $best = null;
        $bestAmount = 0;

        foreach ($promotions as $promotion) {
            if ($promotion->apply_mode !== 'auto' || ! $promotion->is_active) {
                continue;
            }
            if (! $this->isEligible($promotion, $lines, $subtotal, $at)) {
                continue;
            }

            $applied = $this->apply($promotion, $lines, $subtotal, $at);
            $amount = array_sum($applied['item_discounts']) + $applied['sale_discount'];
            if ($amount > $bestAmount || ($amount === $bestAmount && $best && $promotion->priority > $best->priority)) {
                $best = $promotion;
                $bestAmount = $amount;
            } elseif ($amount === $bestAmount && ! $best && $amount > 0) {
                $best = $promotion;
                $bestAmount = $amount;
            }
        }

        return $bestAmount > 0 ? $best : null;
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     * @return array{item_discounts: list<int>, sale_discount: int}
     */
    private function applySimple(Promotion $promotion, array $lines, int $subtotal): array
    {
        $eligible = $this->eligibleIndexes($promotion, $lines);
        $itemDiscounts = array_fill(0, count($lines), 0);

        if ($promotion->scope === 'item') {
            foreach ($eligible as $index) {
                $line = $lines[$index];
                $lineSubtotal = $line['qty'] * $line['price'];
                $itemDiscounts[$index] = $this->lineAmount($promotion, $lineSubtotal, false);
            }
            $total = array_sum($itemDiscounts);
            if ($promotion->max_discount && $total > $promotion->max_discount) {
                $itemDiscounts = $this->scaleAmounts($itemDiscounts, $promotion->max_discount, $eligible);
            }

            return ['item_discounts' => $itemDiscounts, 'sale_discount' => 0];
        }

        $eligibleSubtotal = 0;
        foreach ($eligible as $index) {
            $line = $lines[$index];
            $eligibleSubtotal += $line['qty'] * $line['price'];
        }
        if ($eligibleSubtotal === 0) {
            $eligibleSubtotal = $subtotal;
        }

        $saleDiscount = $this->lineAmount($promotion, $eligibleSubtotal, true);

        return ['item_discounts' => $itemDiscounts, 'sale_discount' => $saleDiscount];
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     * @return array{item_discounts: list<int>, sale_discount: int}
     */
    private function applyBogo(Promotion $promotion, array $lines): array
    {
        if ($this->isCrossItemBogo($promotion)) {
            return $this->applyBogoCrossItem($promotion, $lines);
        }

        return $this->applyBogoSameItem($promotion, $lines);
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     * @return array{item_discounts: list<int>, sale_discount: int}
     */
    private function applyBogoSameItem(Promotion $promotion, array $lines): array
    {
        $config = $promotion->config ?? [];
        $buyQty = max(1, (int) ($config['buy_qty'] ?? 1));
        $getQty = max(1, (int) ($config['get_qty'] ?? 1));
        $setSize = $buyQty + $getQty;

        $itemDiscounts = array_fill(0, count($lines), 0);
        $eligible = $this->indexesMatchingProducts($lines, $this->bogoBuyProductIds($promotion));

        foreach ($eligible as $index) {
            $line = $lines[$index];
            $sets = intdiv((int) $line['qty'], $setSize);
            $freeUnits = $sets * $getQty;
            $itemDiscounts[$index] = (int) round($freeUnits * $line['price']);
        }

        $total = array_sum($itemDiscounts);
        if ($promotion->max_discount && $total > $promotion->max_discount) {
            $itemDiscounts = $this->scaleAmounts($itemDiscounts, $promotion->max_discount, $eligible);
        }

        return ['item_discounts' => $itemDiscounts, 'sale_discount' => 0];
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     * @return array{item_discounts: list<int>, sale_discount: int}
     */
    private function applyBogoCrossItem(Promotion $promotion, array $lines): array
    {
        $config = $promotion->config ?? [];
        $buyQty = max(1, (int) ($config['buy_qty'] ?? 1));
        $getQty = max(1, (int) ($config['get_qty'] ?? 1));
        $itemDiscounts = array_fill(0, count($lines), 0);

        $buyIndexes = $this->indexesMatchingProducts($lines, $this->bogoBuyProductIds($promotion));
        $getIndexes = $this->indexesMatchingProducts($lines, $this->bogoGetProductIds($promotion));

        $buyTotal = 0;
        foreach ($buyIndexes as $index) {
            $buyTotal += (int) $lines[$index]['qty'];
        }
        $sets = intdiv($buyTotal, $buyQty);
        $freeUnits = $sets * $getQty;
        if ($freeUnits <= 0 || $getIndexes === []) {
            return ['item_discounts' => $itemDiscounts, 'sale_discount' => 0];
        }

        usort($getIndexes, function (int $a, int $b) use ($lines) {
            $priceCmp = ((int) $lines[$a]['price']) <=> ((int) $lines[$b]['price']);

            return $priceCmp !== 0 ? $priceCmp : $a <=> $b;
        });

        $discountedIndexes = [];
        foreach ($getIndexes as $index) {
            if ($freeUnits <= 0) {
                break;
            }
            $line = $lines[$index];
            $take = min($freeUnits, (int) $line['qty']);
            $itemDiscounts[$index] = (int) round($take * $line['price']);
            if ($itemDiscounts[$index] > 0) {
                $discountedIndexes[] = $index;
            }
            $freeUnits -= $take;
        }

        $total = array_sum($itemDiscounts);
        if ($promotion->max_discount && $total > $promotion->max_discount) {
            $itemDiscounts = $this->scaleAmounts($itemDiscounts, $promotion->max_discount, $discountedIndexes);
        }

        return ['item_discounts' => $itemDiscounts, 'sale_discount' => 0];
    }

    /**
     * @return list<int>
     */
    private function bogoBuyProductIds(Promotion $promotion): array
    {
        $config = $promotion->config ?? [];
        $ids = $config['buy_product_ids'] ?? [];
        if (is_array($ids) && $ids !== []) {
            return array_values(array_map('intval', $ids));
        }

        return $promotion->products->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * @return list<int>
     */
    private function bogoGetProductIds(Promotion $promotion): array
    {
        $config = $promotion->config ?? [];
        $ids = $config['get_product_ids'] ?? [];
        if (is_array($ids) && $ids !== []) {
            return array_values(array_map('intval', $ids));
        }

        return $this->bogoBuyProductIds($promotion);
    }

    private function isCrossItemBogo(Promotion $promotion): bool
    {
        $config = $promotion->config ?? [];
        $getIds = $config['get_product_ids'] ?? [];
        if (! is_array($getIds) || $getIds === []) {
            return false;
        }

        $buy = $this->bogoBuyProductIds($promotion);
        $get = $this->bogoGetProductIds($promotion);
        sort($buy);
        sort($get);

        return $buy !== $get;
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     */
    private function bogoSetsAvailable(Promotion $promotion, array $lines): int
    {
        $config = $promotion->config ?? [];
        $buyQty = max(1, (int) ($config['buy_qty'] ?? 1));
        $getQty = max(1, (int) ($config['get_qty'] ?? 1));

        if (! $this->isCrossItemBogo($promotion)) {
            $setSize = $buyQty + $getQty;
            $indexes = $this->indexesMatchingProducts($lines, $this->bogoBuyProductIds($promotion));
            $sets = 0;
            foreach ($indexes as $index) {
                $sets += intdiv((int) $lines[$index]['qty'], $setSize);
            }

            return $sets;
        }

        $buyIndexes = $this->indexesMatchingProducts($lines, $this->bogoBuyProductIds($promotion));
        $buyTotal = 0;
        foreach ($buyIndexes as $index) {
            $buyTotal += (int) $lines[$index]['qty'];
        }

        return intdiv($buyTotal, $buyQty);
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     * @param  list<int>  $productIds
     * @param  list<int>  $categoryIds
     * @return list<int>
     */
    private function indexesMatchingProducts(array $lines, array $productIds, array $categoryIds = []): array
    {
        if ($productIds === [] && $categoryIds === []) {
            return array_keys($lines);
        }

        $indexes = [];
        foreach ($lines as $index => $line) {
            $productId = (int) $line['product_id'];
            $categoryId = (int) ($line['category_id'] ?? 0);
            if ($productIds !== [] && in_array($productId, $productIds, true)) {
                $indexes[] = $index;
                continue;
            }
            if ($categoryIds !== [] && $categoryId > 0 && in_array($categoryId, $categoryIds, true)) {
                $indexes[] = $index;
            }
        }

        return $indexes;
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     * @return array{item_discounts: list<int>, sale_discount: int}
     */
    private function applyBundle(Promotion $promotion, array $lines): array
    {
        $bundleCount = $this->bundleCount($promotion, $lines);
        if ($bundleCount <= 0) {
            return ['item_discounts' => array_fill(0, count($lines), 0), 'sale_discount' => 0];
        }

        $config = $promotion->config ?? [];
        $bundlePrice = (int) ($config['bundle_price'] ?? $promotion->value);
        $items = $config['items'] ?? [];
        if ($items === [] && $promotion->products->isNotEmpty()) {
            $items = $promotion->products->map(fn ($product) => ['product_id' => $product->id, 'qty' => 1])->all();
        }

        $regular = 0;
        foreach ($items as $item) {
            $productId = (int) ($item['product_id'] ?? 0);
            $needQty = max(1, (int) ($item['qty'] ?? 1));
            foreach ($lines as $line) {
                if ((int) $line['product_id'] === $productId) {
                    $regular += $line['price'] * $needQty;
                    break;
                }
            }
        }

        $saleDiscount = max(0, ($regular - $bundlePrice) * $bundleCount);
        if ($promotion->max_discount) {
            $saleDiscount = min($saleDiscount, $promotion->max_discount);
        }

        return ['item_discounts' => array_fill(0, count($lines), 0), 'sale_discount' => $saleDiscount];
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     */
    private function bundleCount(Promotion $promotion, array $lines): int
    {
        $config = $promotion->config ?? [];
        $items = $config['items'] ?? [];
        if ($items === [] && $promotion->products->isNotEmpty()) {
            $items = $promotion->products->map(fn ($product) => ['product_id' => $product->id, 'qty' => 1])->all();
        }
        if ($items === []) {
            return 0;
        }

        $counts = [];
        foreach ($items as $item) {
            $productId = (int) ($item['product_id'] ?? 0);
            $needQty = max(1, (int) ($item['qty'] ?? 1));
            $have = 0;
            foreach ($lines as $line) {
                if ((int) $line['product_id'] === $productId) {
                    $have = (int) $line['qty'];
                    break;
                }
            }
            $counts[] = intdiv($have, $needQty);
        }

        return $counts === [] ? 0 : min($counts);
    }

    /**
     * @param  list<array{qty: int, price: int, product_id: int, category_id?: int|null}>  $lines
     * @return list<int>
     */
    private function eligibleIndexes(Promotion $promotion, array $lines): array
    {
        $productIds = $promotion->products->pluck('id')->all();
        $categoryIds = $promotion->categories->pluck('id')->all();
        if ($productIds === [] && $categoryIds === []) {
            return array_keys($lines);
        }

        $indexes = [];
        foreach ($lines as $index => $line) {
            $productId = (int) $line['product_id'];
            $categoryId = (int) ($line['category_id'] ?? 0);
            if ($productIds !== [] && in_array($productId, $productIds, true)) {
                $indexes[] = $index;
                continue;
            }
            if ($categoryIds !== [] && $categoryId > 0 && in_array($categoryId, $categoryIds, true)) {
                $indexes[] = $index;
            }
        }

        return $indexes;
    }

    private function lineAmount(Promotion $promotion, int $lineSubtotal, bool $useMaxCap): int
    {
        if ($lineSubtotal <= 0) {
            return 0;
        }

        if ($promotion->type === 'percent') {
            $amount = (int) round($lineSubtotal * $promotion->value / 100);
            if ($useMaxCap && $promotion->max_discount) {
                $amount = min($amount, $promotion->max_discount);
            }

            return min($amount, $lineSubtotal);
        }

        if ($promotion->type === 'fixed') {
            return min((int) $promotion->value, $lineSubtotal);
        }

        return 0;
    }

    /**
     * @param  list<int>  $amounts
     * @param  list<int>  $indexes
     * @return list<int>
     */
    private function scaleAmounts(array $amounts, int $cap, array $indexes): array
    {
        $eligibleAmounts = [];
        foreach ($indexes as $index) {
            $eligibleAmounts[] = $amounts[$index] ?? 0;
        }
        $total = array_sum($eligibleAmounts);
        if ($total <= 0 || $total <= $cap) {
            return $amounts;
        }

        $scaled = $amounts;
        $remaining = $cap;
        $lastIndex = count($indexes) - 1;
        foreach ($indexes as $i => $index) {
            $amount = $amounts[$index] ?? 0;
            if ($i === $lastIndex) {
                $scaled[$index] = $remaining;
                continue;
            }
            $part = (int) floor($cap * ($amount / $total));
            $scaled[$index] = $part;
            $remaining -= $part;
        }

        return $scaled;
    }
}
