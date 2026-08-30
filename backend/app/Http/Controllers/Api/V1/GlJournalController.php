<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GlJournalEntry;
use App\Services\GlPostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GlJournalController extends Controller
{
    public function __construct(private GlPostingService $posting) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('gljournals', 'view');

        $query = GlJournalEntry::query()
            ->with(['user:id,name'])
            ->orderByDesc('entry_date')
            ->orderByDesc('id');

        if ($sourceType = $request->string('source_type')->toString()) {
            if ($sourceType !== 'all') {
                $query->where('source_type', $sourceType);
            }
        }
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('source_number', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (GlJournalEntry $row) => $this->posting->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function show(GlJournalEntry $glJournalEntry): JsonResponse
    {
        $this->ensureModule('purchase');
        $this->ensureCan('gljournals', 'view');

        return $this->ok($this->posting->serialize($glJournalEntry));
    }
}
