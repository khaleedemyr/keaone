<?php

namespace App\Http\Middleware;

use App\Services\ActivityLogger;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RecordActivity
{
    /** @var list<string> */
    private const SNAPSHOT_KEYS = [
        'product',
        'purchaseRequisition',
        'purchaseOrder',
        'goodsReceipt',
        'sale',
        'customer',
        'supplier',
        'contact',
        'category',
        'sub_category',
        'subCategory',
        'unit',
        'item_type',
        'itemType',
        'price_channel',
        'priceChannel',
        'discount',
        'promotion',
        'custom_field_definition',
        'customFieldDefinition',
        'choice_type',
        'choiceType',
        'choice',
        'warehouse',
        'outlet',
        'user',
        'role',
        'dining_table',
        'diningTable',
        'dining_layout',
        'diningLayout',
        'reminder',
        'company',
        'plan',
        'businessType',
        'blogPost',
        'invoice',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $this->stashSnapshots($request);

        $response = $next($request);

        if (! $this->shouldRecord($request, $response)) {
            return $response;
        }

        ActivityLogger::fromRequest($request, $response->getStatusCode(), $response);

        return $response;
    }

    private function stashSnapshots(Request $request): void
    {
        if (! in_array(strtoupper($request->method()), ['PUT', 'PATCH'], true)) {
            return;
        }

        $snapshots = [];
        foreach (self::SNAPSHOT_KEYS as $key) {
            $model = $request->route($key);
            if ($model instanceof Model) {
                $snapshots[$key] = $model->getAttributes();
            }
        }

        foreach ($request->route()?->parameters() ?? [] as $key => $model) {
            if ($model instanceof Model && ! isset($snapshots[$key])) {
                $snapshots[$key] = $model->getAttributes();
            }
        }

        if ($snapshots !== []) {
            $request->attributes->set('activity_snapshots', $snapshots);
        }
    }

    private function shouldRecord(Request $request, Response $response): bool
    {
        if (! $request->is('api/v1/*')) {
            return false;
        }

        $method = strtoupper($request->method());
        $path = preg_replace('#^api/v1/#', '', trim($request->path(), '/')) ?? $request->path();
        $status = $response->getStatusCode();

        if ($status < 200 || $status >= 300) {
            return false;
        }

        if (str_starts_with($path, 'activity-logs')) {
            return false;
        }

        if (in_array($path, ['auth/login', 'auth/register', 'catalog'], true)) {
            return false;
        }

        if (self::isNoisyPath($path, $method)) {
            return false;
        }

        if ($method === 'GET') {
            return ActivityLogger::isShowPath($path);
        }

        return in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
    }

    private static function isNoisyPath(string $path, string $method): bool
    {
        if (str_starts_with($path, 'chat/')) {
            return true;
        }

        if (str_starts_with($path, 'notifications')) {
            return true;
        }

        if (str_ends_with($path, '/stream')) {
            return true;
        }

        if (str_starts_with($path, 'stock')) {
            return true;
        }

        if ($path === 'approvals/pending' || $path === 'promotions/preview') {
            return true;
        }

        if ($method === 'GET' && in_array($path, ['me', 'company', 'company/settings', 'billing', 'calendar'], true)) {
            return true;
        }

        return false;
    }
}
