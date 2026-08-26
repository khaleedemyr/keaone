<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\ActivityLogger;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('logs');

        return $this->okPage($this->query($request, CurrentCompany::id()), false);
    }

    public function platformIndex(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('logs');

        return $this->okPage($this->query($request, $request->integer('company_id') ?: null), true);
    }

    public function storeEvent(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:open_app,open_section,open_calendar'],
            'target' => ['required', 'string', 'max:40'],
        ]);

        ActivityLogger::client($data['kind'], $data['target'], $request);

        return $this->ok(['ok' => true]);
    }

    private function query(Request $request, ?int $companyId)
    {
        $search = trim((string) $request->string('search'));
        $menu = trim((string) $request->string('menu'));

        return ActivityLog::query()
            ->with(['user:id,name,email', 'company:id,name'])
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->when($menu !== '', fn ($q) => $q->where('menu_key', $menu))
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('summary', 'like', "%{$search}%")
                        ->orWhere('target', 'like', "%{$search}%")
                        ->orWhere('ip', 'like', "%{$search}%")
                        ->orWhereHas('user', function ($user) use ($search) {
                            $user->where('name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%");
                        });
                });
            })
            ->latest('id');
    }

    private function okPage($query, bool $includeCompany): JsonResponse
    {
        $page = $query->paginate($this->perPage(request(), 40));

        return $this->ok(
            $page->getCollection()->map(fn (ActivityLog $row) => $row->toPayload($includeCompany))->values(),
            $this->pageMeta($page),
        );
    }
}
