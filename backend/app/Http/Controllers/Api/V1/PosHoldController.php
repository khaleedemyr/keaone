<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PosHold;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PosHoldController extends Controller
{
    private const MAX_HOLDS = 20;

    public function index(): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCanAny(['pos', 'sales']);

        $outlet = CurrentCompany::outlet();
        abort_unless($outlet, 422, 'Outlet tidak ditemukan.');

        $rows = PosHold::query()
            ->with('user:id,name')
            ->where('outlet_id', $outlet->id)
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit(self::MAX_HOLDS)
            ->get()
            ->map(fn (PosHold $hold) => $hold->toPosArray())
            ->values();

        return $this->ok($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCanAny([['pos', 'create'], ['sales', 'create']]);
        $this->ensureBilling();

        $outlet = CurrentCompany::outlet();
        abort_unless($outlet, 422, 'Outlet tidak ditemukan.');

        $data = $request->validate([
            'uuid' => ['nullable', 'uuid'],
            'label' => ['required', 'string', 'max:160'],
            'lines' => ['required', 'array', 'min:1', 'max:200'],
            'lines.*.product_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
            'lines.*.promo_free_qty' => ['nullable', 'integer', 'min:0'],
            'lines.*.name' => ['required', 'string', 'max:190'],
            'lines.*.sku' => ['nullable', 'string', 'max:80'],
            'lines.*.sell_price' => ['required', 'integer', 'min:0'],
            'method' => ['required', Rule::in(['cash', 'transfer', 'qris'])],
            'discountId' => ['nullable'],
            'promotionId' => ['nullable'],
            'promoCodeInput' => ['nullable', 'string', 'max:40'],
            'promoCodeAppliedId' => ['nullable', 'integer'],
            'suppressAutoPromo' => ['nullable', 'boolean'],
            'channelCode' => ['nullable', 'string', 'max:40'],
            'payAmount' => ['nullable', 'string', 'max:40'],
            'splitPay' => ['nullable', 'boolean'],
            'tenders' => ['nullable', 'array', 'max:5'],
        ]);

        $uuid = (string) ($data['uuid'] ?? Str::uuid());
        $payload = [
            'lines' => array_values($data['lines']),
            'method' => $data['method'],
            'discountId' => $data['discountId'] ?? '',
            'promotionId' => $data['promotionId'] ?? '',
            'promoCodeInput' => (string) ($data['promoCodeInput'] ?? ''),
            'promoCodeAppliedId' => $data['promoCodeAppliedId'] ?? null,
            'suppressAutoPromo' => (bool) ($data['suppressAutoPromo'] ?? false),
            'channelCode' => (string) ($data['channelCode'] ?? 'pos'),
            'payAmount' => (string) ($data['payAmount'] ?? ''),
            'splitPay' => (bool) ($data['splitPay'] ?? false),
            'tenders' => is_array($data['tenders'] ?? null) ? $data['tenders'] : [],
        ];

        $existing = PosHold::query()
            ->where('outlet_id', $outlet->id)
            ->where('uuid', $uuid)
            ->first();

        if ($existing) {
            $existing->update([
                'label' => $data['label'],
                'payload' => $payload,
                'user_id' => $request->user()?->id,
            ]);
            $hold = $existing->fresh(['user:id,name']);
        } else {
            $hold = PosHold::query()->create([
                'company_id' => CurrentCompany::id(),
                'outlet_id' => $outlet->id,
                'user_id' => $request->user()?->id,
                'uuid' => $uuid,
                'label' => $data['label'],
                'payload' => $payload,
            ]);
            $hold->load('user:id,name');
        }

        $this->trimOutletHolds((int) $outlet->id);

        return $this->ok($hold->toPosArray(), [], $existing ? 200 : 201);
    }

    public function destroy(PosHold $posHold): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCanAny([['pos', 'create'], ['sales', 'create'], ['pos', 'delete'], ['sales', 'delete']]);

        $outlet = CurrentCompany::outlet();
        if (! $outlet || (int) $posHold->outlet_id !== (int) $outlet->id) {
            throw ValidationException::withMessages([
                'hold' => ['Hold tidak ditemukan di outlet ini.'],
            ]);
        }

        $posHold->delete();

        return $this->ok(['deleted' => true]);
    }

    private function trimOutletHolds(int $outletId): void
    {
        $keepIds = PosHold::query()
            ->where('outlet_id', $outletId)
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit(self::MAX_HOLDS)
            ->pluck('id');

        if ($keepIds->isEmpty()) {
            return;
        }

        PosHold::query()
            ->where('outlet_id', $outletId)
            ->whereNotIn('id', $keepIds)
            ->delete();
    }
}
