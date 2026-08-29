<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use App\Services\NotificationService;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class NotificationController extends Controller
{
    public function __construct(private NotificationService $notifications) {}

    public function index(Request $request): JsonResponse
    {
        abort_unless(CurrentCompany::id() && $request->user(), 401);

        $query = UserNotification::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id');

        if ($request->boolean('unread_only')) {
            $query->whereNull('read_at');
        }

        $page = $query->paginate($this->perPage($request, 30));

        return $this->ok(
            $page->getCollection()->map(fn (UserNotification $row) => $this->notifications->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function stream(Request $request): StreamedResponse
    {
        abort_unless(CurrentCompany::id() && $request->user(), 401);

        $userId = (int) $request->user()->id;
        $lastId = max(0, $request->integer('last_id'));

        return response()->stream(function () use ($userId, $lastId) {
            @set_time_limit(0);
            $cursor = $lastId;
            $started = time();

            while (! connection_aborted() && (time() - $started) < 3600) {
                $rows = UserNotification::query()
                    ->where('user_id', $userId)
                    ->when($cursor > 0, fn ($q) => $q->where('id', '>', $cursor))
                    ->orderBy('id')
                    ->limit(20)
                    ->get();

                foreach ($rows as $row) {
                    echo 'event: notification'."\n";
                    echo 'data: '.json_encode($this->notifications->serialize($row), JSON_UNESCAPED_UNICODE)."\n\n";
                    $cursor = (int) $row->id;
                }

                echo ": heartbeat\n\n";
                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();

                sleep(5);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        abort_unless(CurrentCompany::id() && $request->user(), 401);

        $count = UserNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return $this->ok(['count' => $count]);
    }

    public function markRead(Request $request, UserNotification $notification): JsonResponse
    {
        abort_unless(CurrentCompany::id() && $request->user(), 401);
        abort_unless((int) $notification->user_id === (int) $request->user()->id, 403);

        if (! $notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        return $this->ok($this->notifications->serialize($notification->fresh()));
    }

    public function markAllRead(Request $request): JsonResponse
    {
        abort_unless(CurrentCompany::id() && $request->user(), 401);

        UserNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $this->ok(['ok' => true]);
    }
}
