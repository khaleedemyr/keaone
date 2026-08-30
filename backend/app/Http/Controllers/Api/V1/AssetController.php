<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Services\AssetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AssetController extends Controller
{
    public function __construct(private AssetService $assets) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('fixedassets', 'view');

        $query = Asset::query()->orderByDesc('acquired_at')->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('name_snapshot', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        if ($grId = $request->integer('goods_receipt_id')) {
            $query->where('goods_receipt_id', $grId);
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (Asset $row) => $this->assets->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function show(Asset $asset): JsonResponse
    {
        $this->ensureCan('fixedassets', 'view');

        return $this->ok($this->assets->serialize($asset));
    }

    public function update(Request $request, Asset $asset): JsonResponse
    {
        $this->ensureCan('fixedassets', 'edit');

        if ($asset->status !== 'active') {
            throw ValidationException::withMessages(['status' => ['Aset void tidak bisa diubah.']]);
        }

        $data = $request->validate([
            'serial_number' => ['nullable', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:255'],
            'custodian_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        if (array_key_exists('serial_number', $data)) {
            $data['serial_number'] = $data['serial_number'] !== '' ? $data['serial_number'] : null;
        }
        if (array_key_exists('location', $data)) {
            $data['location'] = $data['location'] !== '' ? $data['location'] : null;
        }
        if (array_key_exists('custodian_user_id', $data) && ! $data['custodian_user_id']) {
            $data['custodian_user_id'] = null;
        }
        if (array_key_exists('note', $data)) {
            $data['note'] = $data['note'] !== '' ? $data['note'] : null;
        }

        $asset->update($data);

        return $this->ok($this->assets->serialize($asset->fresh()));
    }
}
