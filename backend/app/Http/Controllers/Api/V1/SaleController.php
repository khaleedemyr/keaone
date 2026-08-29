<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateSalesReportJob;
use App\Models\Sale;
use App\Services\SaleService;
use App\Support\CurrentCompany;
use App\Support\MenuCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SaleController extends Controller
{
    public function __construct(private SaleService $sales) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCan('sales', 'view');

        $query = Sale::query()
            ->with(['items', 'payments', 'contact', 'user'])
            ->orderByDesc('sold_at')
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        $sales = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $sales->getCollection()->map(fn (Sale $sale) => $this->sales->serialize($sale))->values(),
            $this->pageMeta($sales),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCanAny([['sales', 'create'], ['pos', 'create']]);
        $this->ensureBilling();

        $data = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'contact_id' => ['nullable', 'integer'],
            'channel' => ['nullable', 'string', 'max:40'],
            'discount' => ['nullable', 'integer', 'min:0'],
            'discount_id' => ['nullable', 'integer'],
            'promotion_id' => ['nullable', 'integer'],
            'promo_code' => ['nullable', 'string', 'max:40'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.discount' => ['nullable', 'integer', 'min:0'],
            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['required', Rule::in(['cash', 'transfer', 'qris'])],
            'payments.*.amount' => ['required', 'integer', 'min:1'],
            'payments.*.client_uuid' => ['nullable', 'string', 'max:64'],
            'payments.*.note' => ['nullable', 'string'],
        ]);

        $sale = $this->sales->create($data, $request->user());

        return $this->ok($this->sales->serialize($sale), [], 201);
    }

    public function settlement(Request $request): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCanAny(['sales', 'pos']);

        return $this->ok($this->sales->settlement($request->user()));
    }

    public function reports(Request $request): JsonResponse
    {
        $this->ensureModule('pos');

        $data = $request->validate([
            'kind' => ['nullable', Rule::in(['summary', 'products', 'cashiers', 'methods', 'channels', 'daily'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $kind = $data['kind'] ?? 'summary';
        $this->ensureCan(MenuCatalog::salesReportMenu($kind), 'view');

        $from = $data['from'] ?? now()->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->toDateString();

        return $this->ok($this->sales->salesReport($kind, $from, $to));
    }

    public function reportsAsync(Request $request): JsonResponse
    {
        $this->ensureModule('pos');

        $data = $request->validate([
            'kind' => ['nullable', Rule::in(['summary', 'products', 'cashiers', 'methods', 'channels', 'daily'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $kind = $data['kind'] ?? 'summary';
        $this->ensureCan(MenuCatalog::salesReportMenu($kind), 'view');

        $from = $data['from'] ?? now()->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->toDateString();
        $companyId = (int) CurrentCompany::id();
        $outletId = CurrentCompany::outlet()?->id;

        $jobId = 'sales_report:'.$companyId.':'.Str::uuid()->toString();
        Cache::put($jobId, ['status' => 'pending'], now()->addHour());

        GenerateSalesReportJob::dispatch($jobId, [
            'kind' => $kind,
            'from' => $from,
            'to' => $to,
            'outlet_id' => $outletId,
        ]);

        return $this->ok(['job_id' => $jobId, 'status' => 'pending'], [], 202);
    }

    public function reportsAsyncStatus(string $jobId): JsonResponse
    {
        $this->ensureModule('pos');

        $companyId = (int) CurrentCompany::id();
        if (! str_starts_with($jobId, 'sales_report:'.$companyId.':')) {
            return $this->error('Laporan tidak ditemukan.', [], 404);
        }

        $payload = Cache::get($jobId);
        if (! is_array($payload)) {
            return $this->error('Laporan tidak ditemukan.', [], 404);
        }

        return $this->ok($payload);
    }

    public function show(Sale $sale): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCanAny(['sales', 'pos']);

        return $this->ok($this->sales->serialize($sale));
    }

    public function receipt(Sale $sale): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCanAny(['sales', 'pos']);

        return $this->ok($this->sales->receipt($sale));
    }

    public function addPayment(Request $request, Sale $sale): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCan('sales', 'edit');
        $this->ensureBilling();

        $data = $request->validate([
            'method' => ['required', Rule::in(['cash', 'transfer', 'qris'])],
            'amount' => ['required', 'integer', 'min:1'],
            'client_uuid' => ['nullable', 'string', 'max:64'],
            'note' => ['nullable', 'string'],
        ]);

        $sale = $this->sales->addPayment($sale, $data, $request->user());

        return $this->ok($this->sales->serialize($sale));
    }

    public function cancel(Request $request, Sale $sale): JsonResponse
    {
        $this->ensureModule('pos');
        $this->ensureCan('sales', 'delete');

        $sale = $this->sales->cancel($sale, $request->user());

        return $this->ok($this->sales->serialize($sale));
    }
}
