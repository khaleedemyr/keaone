<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockBalance;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;

class StockController extends Controller
{
    public function index(): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stock', 'view');

        $outletId = CurrentCompany::outlet()?->id;

        $rows = Product::query()
            ->where('track_stock', true)
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(function (Product $product) use ($outletId) {
                $qty = (int) StockBalance::query()
                    ->where('outlet_id', $outletId)
                    ->where('product_id', $product->id)
                    ->value('qty');

                return [
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'barcode' => $product->barcode,
                    'qty' => $qty,
                    'min_stock' => $product->min_stock,
                    'unit' => $product->unit,
                ];
            });

        return $this->ok($rows);
    }

    public function low(): JsonResponse
    {
        $this->ensureModule('stock');
        $this->ensureCan('stock', 'view');

        $outletId = CurrentCompany::outlet()?->id;

        $rows = Product::query()
            ->where('track_stock', true)
            ->where('is_active', true)
            ->get()
            ->map(function (Product $product) use ($outletId) {
                $qty = (int) StockBalance::query()
                    ->where('outlet_id', $outletId)
                    ->where('product_id', $product->id)
                    ->value('qty');

                return [
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'qty' => $qty,
                    'min_stock' => $product->min_stock,
                    'unit' => $product->unit,
                ];
            })
            ->filter(fn (array $row) => $row['qty'] <= $row['min_stock'])
            ->values();

        return $this->ok($rows);
    }
}
