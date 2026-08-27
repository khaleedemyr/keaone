<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlatformSupportController extends Controller
{
    public function conversations(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('livesupport', 'view');

        $meId = (int) $request->user()->id;

        $rows = Conversation::withoutGlobalScope('company')
            ->where('type', 'support')
            ->with([
                'company:id,name',
                'latestMessage.user:id,name,avatar,is_platform',
                'participants.user:id,name,email,username,avatar,is_active,is_platform',
            ])
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (Conversation $c) => $this->serialize($c, $meId));

        return $this->ok($rows);
    }

    public function join(Request $request, int $conversation): JsonResponse
    {
        $this->ensurePlatformCan('livesupport', 'view');

        $meId = (int) $request->user()->id;
        $row = $this->findSupport($conversation);
        $this->ensureJoined($row, $meId);

        $row->load([
            'company:id,name',
            'latestMessage.user:id,name,avatar,is_platform',
            'participants.user:id,name,email,username,avatar,is_active,is_platform',
        ]);

        return $this->ok($this->serialize($row, $meId));
    }

    public function messages(Request $request, int $conversation): JsonResponse
    {
        $this->ensurePlatformCan('livesupport', 'view');

        $meId = (int) $request->user()->id;
        $row = $this->findSupport($conversation);
        $this->ensureJoined($row, $meId);

        $afterId = $request->integer('after_id');
        $beforeId = $request->integer('before_id');
        $limit = min(max($request->integer('limit', 50), 1), 100);

        $query = Message::withoutGlobalScope('company')
            ->where('conversation_id', $row->id)
            ->with('user:id,name,avatar,is_platform');

        if ($afterId > 0) {
            $items = $query->where('id', '>', $afterId)->orderBy('id')->limit($limit)->get();
        } elseif ($beforeId > 0) {
            $items = $query->where('id', '<', $beforeId)->orderByDesc('id')->limit($limit)->get()->reverse()->values();
        } else {
            $items = $query->orderByDesc('id')->limit($limit)->get()->reverse()->values();
        }

        return $this->ok($items->map(fn (Message $m) => $this->serializeMessage($m))->values());
    }

    public function storeMessage(Request $request, int $conversation): JsonResponse
    {
        $this->ensurePlatformCan('livesupport', 'create');

        $meId = (int) $request->user()->id;
        $row = $this->findSupport($conversation);
        $this->ensureJoined($row, $meId);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:4000'],
        ]);

        $body = trim($data['body']);
        abort_if($body === '', 422, 'Pesan kosong.');

        $message = DB::transaction(function () use ($row, $meId, $body) {
            $message = Message::withoutGlobalScope('company')->create([
                'company_id' => $row->company_id,
                'conversation_id' => $row->id,
                'user_id' => $meId,
                'body' => $body,
            ]);

            Conversation::withoutGlobalScope('company')
                ->whereKey($row->id)
                ->update(['last_message_at' => now()]);

            ConversationParticipant::query()
                ->where('conversation_id', $row->id)
                ->where('user_id', $meId)
                ->update(['last_read_at' => now()]);

            return $message;
        });

        $message->load('user:id,name,avatar,is_platform');

        return $this->ok($this->serializeMessage($message), [], 201);
    }

    public function markRead(Request $request, int $conversation): JsonResponse
    {
        $this->ensurePlatformCan('livesupport', 'view');

        $meId = (int) $request->user()->id;
        $row = $this->findSupport($conversation);
        $this->ensureJoined($row, $meId);

        ConversationParticipant::query()
            ->where('conversation_id', $row->id)
            ->where('user_id', $meId)
            ->update(['last_read_at' => now()]);

        return $this->ok(['ok' => true]);
    }

    private function findSupport(int $id): Conversation
    {
        $row = Conversation::withoutGlobalScope('company')
            ->where('type', 'support')
            ->whereKey($id)
            ->first();

        abort_unless($row, 404, 'Percakapan tidak ditemukan.');

        return $row;
    }

    private function ensureJoined(Conversation $conversation, int $userId): void
    {
        ConversationParticipant::query()->firstOrCreate(
            [
                'conversation_id' => $conversation->id,
                'user_id' => $userId,
            ],
            ['last_read_at' => null],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Conversation $conversation, int $meId): array
    {
        $customer = $conversation->participants
            ->first(fn (ConversationParticipant $p) => $p->user && ! $p->user->is_platform)
            ?->user;

        $mine = $conversation->participants
            ->first(fn (ConversationParticipant $p) => (int) $p->user_id === $meId);

        $last = $conversation->latestMessage;
        $unread = 0;
        if ($mine) {
            $unreadQuery = Message::withoutGlobalScope('company')
                ->where('conversation_id', $conversation->id)
                ->where('user_id', '!=', $meId);
            if ($mine->last_read_at) {
                $unreadQuery->where('created_at', '>', $mine->last_read_at);
            }
            $unread = (int) $unreadQuery->count();
        } else {
            $unread = (int) Message::withoutGlobalScope('company')
                ->where('conversation_id', $conversation->id)
                ->where('user_id', '!=', $meId)
                ->count();
        }

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'title' => $conversation->title,
            'company' => $conversation->relationLoaded('company') && $conversation->company
                ? ['id' => $conversation->company->id, 'name' => $conversation->company->name]
                : null,
            'peer' => $customer ? [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'username' => $customer->username,
                'avatar' => $customer->avatarUrl(),
                'is_online' => false,
                'last_seen_at' => null,
                'is_platform' => false,
            ] : null,
            'last_message' => $last ? $this->serializeMessage($last) : null,
            'last_message_at' => optional($conversation->last_message_at)?->toIso8601String(),
            'unread_count' => $unread,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeMessage(Message $message): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'user_id' => $message->user_id,
            'body' => $message->body,
            'created_at' => optional($message->created_at)?->toIso8601String(),
            'user' => $message->relationLoaded('user') && $message->user
                ? [
                    'id' => $message->user->id,
                    'name' => $message->user->name,
                    'email' => $message->user->email ?? null,
                    'username' => $message->user->username ?? null,
                    'avatar' => $message->user->avatarUrl(),
                    'is_online' => false,
                    'last_seen_at' => null,
                    'is_platform' => (bool) $message->user->is_platform,
                ]
                : null,
        ];
    }
}
