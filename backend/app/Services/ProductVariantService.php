<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariantAttribute;
use App\Models\ProductVariantOption;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductVariantService
{
    /**
     * @param  list<array{
     *   id?: mixed,
     *   name?: mixed,
     *   show_in_storefront?: mixed,
     *   sort_order?: mixed,
     *   options?: list<array{
     *     id?: mixed,
     *     name?: mixed,
     *     extra_price?: mixed,
     *     sort_order?: mixed,
     *     is_active?: mixed,
     *     clear_image?: mixed
     *   }>
     * }>|null  $rows
     */
    public function sync(Product $product, ?array $rows): void
    {
        if ($rows === null) {
            return;
        }

        DB::transaction(function () use ($product, $rows) {
            $keepAttributeIds = [];
            $keepOptionIds = [];

            foreach (array_values($rows) as $attrIndex => $rawAttr) {
                $name = trim((string) ($rawAttr['name'] ?? ''));
                if ($name === '') {
                    throw ValidationException::withMessages([
                        "variant_attributes.$attrIndex.name" => ['Nama atribut variasi wajib diisi.'],
                    ]);
                }

                $attributeId = isset($rawAttr['id']) ? (int) $rawAttr['id'] : 0;
                $attribute = null;
                if ($attributeId > 0) {
                    $attribute = ProductVariantAttribute::query()
                        ->where('product_id', $product->id)
                        ->whereKey($attributeId)
                        ->first();
                }

                $payload = [
                    'company_id' => $product->company_id,
                    'product_id' => $product->id,
                    'name' => $name,
                    'sort_order' => isset($rawAttr['sort_order']) ? (int) $rawAttr['sort_order'] : $attrIndex,
                    'show_in_storefront' => array_key_exists('show_in_storefront', $rawAttr)
                        ? (bool) $rawAttr['show_in_storefront']
                        : true,
                ];

                if ($attribute) {
                    $attribute->update($payload);
                } else {
                    $attribute = ProductVariantAttribute::query()->create($payload);
                }

                $keepAttributeIds[] = (int) $attribute->id;

                $options = is_array($rawAttr['options'] ?? null) ? array_values($rawAttr['options']) : [];
                if ($options === []) {
                    throw ValidationException::withMessages([
                        "variant_attributes.$attrIndex.options" => ['Setiap atribut minimal punya 1 opsi.'],
                    ]);
                }

                foreach ($options as $optIndex => $rawOpt) {
                    $optName = trim((string) ($rawOpt['name'] ?? ''));
                    if ($optName === '') {
                        throw ValidationException::withMessages([
                            "variant_attributes.$attrIndex.options.$optIndex.name" => ['Nama opsi wajib diisi.'],
                        ]);
                    }

                    $optionId = isset($rawOpt['id']) ? (int) $rawOpt['id'] : 0;
                    $option = null;
                    if ($optionId > 0) {
                        $option = ProductVariantOption::query()
                            ->where('product_id', $product->id)
                            ->where('attribute_id', $attribute->id)
                            ->whereKey($optionId)
                            ->first();
                    }

                    $optionPayload = [
                        'company_id' => $product->company_id,
                        'product_id' => $product->id,
                        'attribute_id' => $attribute->id,
                        'name' => $optName,
                        'sort_order' => isset($rawOpt['sort_order']) ? (int) $rawOpt['sort_order'] : $optIndex,
                        'extra_price' => max(0, (int) ($rawOpt['extra_price'] ?? 0)),
                        'is_active' => array_key_exists('is_active', $rawOpt) ? (bool) $rawOpt['is_active'] : true,
                    ];

                    if ($option) {
                        if (! empty($rawOpt['clear_image'])) {
                            $this->deleteImageFile($option);
                            $optionPayload['image_path'] = null;
                        }
                        $option->update($optionPayload);
                    } else {
                        $option = ProductVariantOption::query()->create($optionPayload);
                    }

                    $keepOptionIds[] = (int) $option->id;
                }
            }

            $obsoleteOptionsQuery = ProductVariantOption::query()->where('product_id', $product->id);
            if ($keepOptionIds !== []) {
                $obsoleteOptionsQuery->whereNotIn('id', $keepOptionIds);
            }
            foreach ($obsoleteOptionsQuery->get() as $option) {
                $this->deleteImageFile($option);
                $option->delete();
            }

            $obsoleteAttributesQuery = ProductVariantAttribute::query()->where('product_id', $product->id);
            if ($keepAttributeIds !== []) {
                $obsoleteAttributesQuery->whereNotIn('id', $keepAttributeIds);
            }
            $obsoleteAttributesQuery->delete();
        });
    }

    public function storeOptionImage(Product $product, ProductVariantOption $option, UploadedFile $uploaded): ProductVariantOption
    {
        if ((int) $option->product_id !== (int) $product->id) {
            abort(404);
        }

        abort_unless($uploaded->isValid(), 422, 'Unggahan foto gagal.');

        $info = @getimagesize($uploaded->getRealPath() ?: $uploaded->getPathname());
        abort_unless($info !== false, 422, 'File bukan gambar yang valid.');

        $ext = match ($info[2] ?? 0) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        };
        abort_unless($ext, 422, 'Format gambar tidak didukung. Pakai JPG, PNG, atau WebP.');

        $dir = storage_path('app/public/products');
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder foto produk.');
        }

        $this->deleteImageFile($option);

        $name = $product->id.'_opt_'.Str::uuid().'.'.$ext;
        $uploaded->move($dir, $name);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$name), 422, 'Tidak bisa menyimpan foto.');

        $option->update(['image_path' => 'products/'.$name]);

        return $option->fresh();
    }

    public function clearOptionImage(Product $product, ProductVariantOption $option): ProductVariantOption
    {
        if ((int) $option->product_id !== (int) $product->id) {
            abort(404);
        }

        $this->deleteImageFile($option);
        $option->update(['image_path' => null]);

        return $option->fresh();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function serialize(Product $product, bool $storefrontOnly = false): array
    {
        $attributes = $product->relationLoaded('variantAttributes')
            ? $product->variantAttributes
            : $product->variantAttributes()->with('options')->orderBy('sort_order')->orderBy('id')->get();

        return $attributes
            ->when($storefrontOnly, fn ($col) => $col->where('show_in_storefront', true))
            ->values()
            ->map(function (ProductVariantAttribute $attr) use ($storefrontOnly) {
                $options = $attr->relationLoaded('options')
                    ? $attr->options
                    : $attr->options()->orderBy('sort_order')->orderBy('id')->get();

                $mapped = $options
                    ->when($storefrontOnly, fn ($col) => $col->where('is_active', true))
                    ->values()
                    ->map(fn (ProductVariantOption $opt) => [
                        'id' => (int) $opt->id,
                        'name' => $opt->name,
                        'sort_order' => (int) $opt->sort_order,
                        'extra_price' => (int) $opt->extra_price,
                        'image_url' => $opt->url(),
                        'is_active' => (bool) $opt->is_active,
                    ])
                    ->all();

                return [
                    'id' => (int) $attr->id,
                    'name' => $attr->name,
                    'sort_order' => (int) $attr->sort_order,
                    'show_in_storefront' => (bool) $attr->show_in_storefront,
                    'options' => $mapped,
                ];
            })
            ->filter(fn (array $row) => ! $storefrontOnly || $row['options'] !== [])
            ->values()
            ->all();
    }

    private function deleteImageFile(ProductVariantOption $option): void
    {
        $path = $option->absolutePath();
        if ($path && is_file($path)) {
            @unlink($path);
        }
    }
}
