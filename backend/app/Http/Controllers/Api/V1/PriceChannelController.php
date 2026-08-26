<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PriceChannel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PriceChannelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['pricechannels', 'products', 'pos']);
        } else {
            $this->ensureCan('pricechannels', 'view');
        }

        $query = PriceChannel::query()->orderBy('sort_order')->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('pricechannels', 'create');

        $item = PriceChannel::query()->create($this->validated($request));

        return $this->ok($item, [], 201);
    }

    public function update(Request $request, PriceChannel $priceChannel): JsonResponse
    {
        $this->ensureCan('pricechannels', 'edit');

        $priceChannel->update($this->validated($request, $priceChannel->id));

        return $this->ok($priceChannel->fresh());
    }

    public function destroy(PriceChannel $priceChannel): JsonResponse
    {
        $this->ensureCanAny([['pricechannels', 'delete'], ['pricechannels', 'edit']]);
        $priceChannel->update(['is_active' => false]);

        return $this->ok($priceChannel->fresh());
    }

    private function validated(Request $request, ?int $id = null): array
    {
        $data = $request->validate([
            'name' => [$id ? 'sometimes' : 'required', 'string', 'max:100'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (! $id && array_key_exists('name', $data)) {
            $data['code'] = $this->uniqueCode((string) $data['name']);
        }

        return $data;
    }

    private function uniqueCode(string $name): string
    {
        $base = Str::slug($name) ?: 'channel';
        $code = $base;
        $i = 2;
        while (PriceChannel::query()->where('code', $code)->exists()) {
            $code = $base.'-'.$i;
            $i++;
        }

        return Str::limit($code, 40, '');
    }
}
