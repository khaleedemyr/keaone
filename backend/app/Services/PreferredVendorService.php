<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Contact;
use App\Models\Product;
use App\Support\CurrentCompany;
use Illuminate\Validation\ValidationException;

class PreferredVendorService
{
    public function resolveForProduct(Product $product): ?int
    {
        $product->loadMissing('category:id,preferred_supplier_id');

        if ($product->preferred_supplier_id) {
            return (int) $product->preferred_supplier_id;
        }

        if ($product->category?->preferred_supplier_id) {
            return (int) $product->category->preferred_supplier_id;
        }

        return null;
    }

    public function resolveForProductId(int $productId): ?int
    {
        $product = Product::query()->find($productId);

        return $product ? $this->resolveForProduct($product) : null;
    }

    public function assertSupplier(?int $supplierId): void
    {
        if (! $supplierId) {
            return;
        }

        $company = CurrentCompany::company();
        abort_unless($company, 422, 'Pilih perusahaan dulu.');

        $ok = Contact::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->whereKey($supplierId)
            ->whereIn('type', ['supplier', 'both'])
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages([
                'preferred_supplier_id' => ['Supplier tidak valid.'],
            ]);
        }
    }

    public function syncProductPreferred(Product $product, ?int $supplierId): void
    {
        $this->assertSupplier($supplierId);
        $product->update(['preferred_supplier_id' => $supplierId ?: null]);
    }

    public function syncCategoryPreferred(Category $category, ?int $supplierId): void
    {
        $this->assertSupplier($supplierId);
        $category->update(['preferred_supplier_id' => $supplierId ?: null]);
    }
}
