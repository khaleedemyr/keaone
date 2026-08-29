<?php

namespace App\Jobs;

use App\Services\SaleService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class GenerateSalesReportJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $timeout = 300;

    /**
     * @param  array{kind: string, from: string, to: string, outlet_id: int|null}  $params
     */
    public function __construct(
        public string $cacheKey,
        public array $params,
    ) {}

    public function handle(SaleService $sales): void
    {
        try {
            $data = $sales->salesReportUncached(
                $this->params['kind'],
                $this->params['from'],
                $this->params['to'],
                $this->params['outlet_id'],
            );

            Cache::put($this->cacheKey, [
                'status' => 'ready',
                'data' => $data,
            ], now()->addHour());
        } catch (\Throwable $e) {
            Cache::put($this->cacheKey, [
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], now()->addMinutes(15));

            throw $e;
        }
    }
}
