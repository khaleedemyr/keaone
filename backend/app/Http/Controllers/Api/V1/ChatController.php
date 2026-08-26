<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanyUser;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ChatController extends Controller
{
    /** Seconds without heartbeat before a peer is considered offline. */
    private const ONLINE_WINDOW_SECONDS = 90;

    public function presence(Request $request): JsonResponse
    {
        $this->ensureCan('chat', 'view');

        $companyId = CurrentCompany::id();
        $meId = (int) $request->user()->id;

        CompanyUser::query()
            ->where('company_id', $companyId)
            ->where('user_id', $meId)
            ->where('is_active', true)
            ->update(['last_seen_at' => now()]);

        return $this->ok(['ok' => true, 'online_window' => self::ONLINE_WINDOW_SECONDS]);
    }

    public function peers(Request $request): JsonResponse
    {
        $this->ensureCan('chat', 'view');

        $companyId = CurrentCompany::id();
        $meId = (int) $request->user()->id;
        $search = trim($request->string('search')->toString());

        $memberships = CompanyUser::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->where('user_id', '!=', $meId)
            ->get(['user_id', 'last_seen_at']);

        $presence = $this->presenceMap($memberships);
        $userIds = $memberships->pluck('user_id');

        $query = User::query()
            ->whereIn('id', $userIds)
            ->where('is_active', true)
            ->orderBy('name');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%");
            });
        }

        $peers = $query->limit(200)->get()->map(
            fn (User $user) => $this->serializeUser($user, $presence[(int) $user->id] ?? null),
        );

        return $this->ok($peers);
    }

    public function conversations(Request $request): JsonResponse
    {
        $this->ensureCan('chat', 'view');

        $meId = (int) $request->user()->id;
        $companyId = CurrentCompany::id();

        $presence = $this->presenceMap(
            CompanyUser::query()
                ->where('company_id', $companyId)
                ->where('is_active', true)
                ->get(['user_id', 'last_seen_at']),
        );

        $rows = Conversation::query()
            ->whereHas('participants', fn ($q) => $q->where('user_id', $meId))
            ->with([
                'latestMessage.user:id,name,avatar',
                'participants.user:id,name,email,username,avatar,is_active',
            ])
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (Conversation $c) => $this->serializeConversation($c, $meId, $presence));

        return $this->ok($rows);
    }

    public function storeConversation(Request $request): JsonResponse
    {
        $this->ensureCan('chat', 'create');

        $companyId = CurrentCompany::id();
        $meId = (int) $request->user()->id;

        $data = $request->validate([
            'user_id' => [
                'required',
                'integer',
                Rule::notIn([$meId]),
                Rule::exists('company_user', 'user_id')->where(fn ($q) => $q
                    ->where('company_id', $companyId)
                    ->where('is_active', true)),
            ],
        ]);

        $peerId = (int) $data['user_id'];
        User::query()->where('id', $peerId)->where('is_active', true)->firstOrFail();

        $key = Conversation::directKey($meId, $peerId);
        $created = false;

        $conversation = DB::transaction(function () use ($companyId, $meId, $peerId, $key, &$created) {
            $existing = Conversation::query()
                ->where('type', 'direct')
                ->where('direct_key', $key)
                ->first();

            if ($existing) {
                return $existing;
            }

            $conversation = Conversation::query()->create([
                'company_id' => $companyId,
                'type' => 'direct',
                'direct_key' => $key,
            ]);

            foreach ([$meId, $peerId] as $uid) {
                ConversationParticipant::query()->create([
                    'conversation_id' => $conversation->id,
                    'user_id' => $uid,
                ]);
            }

            $created = true;

            return $conversation;
        });

        $conversation->load([
            'latestMessage.user:id,name,avatar',
            'participants.user:id,name,email,username,avatar,is_active',
        ]);

        $presence = $this->presenceMap(
            CompanyUser::query()
                ->where('company_id', $companyId)
                ->where('user_id', $peerId)
                ->get(['user_id', 'last_seen_at']),
        );

        return $this->ok($this->serializeConversation($conversation, $meId, $presence), [], $created ? 201 : 200);
    }

    public function messages(Request $request, Conversation $conversation): JsonResponse
    {
        $this->ensureCan('chat', 'view');
        $meId = (int) $request->user()->id;
        $this->ensureParticipant($conversation, $meId);

        $afterId = $request->integer('after_id');
        $beforeId = $request->integer('before_id');
        $limit = min(max($request->integer('limit', 50), 1), 100);

        $query = Message::query()
            ->where('conversation_id', $conversation->id)
            ->with('user:id,name,avatar');

        if ($afterId > 0) {
            $items = $query->where('id', '>', $afterId)->orderBy('id')->limit($limit)->get();
        } elseif ($beforeId > 0) {
            $items = $query->where('id', '<', $beforeId)->orderByDesc('id')->limit($limit)->get()->reverse()->values();
        } else {
            $items = $query->orderByDesc('id')->limit($limit)->get()->reverse()->values();
        }

        return $this->ok($items->map(fn (Message $m) => $this->serializeMessage($m))->values());
    }

    public function storeMessage(Request $request, Conversation $conversation): JsonResponse
    {
        $this->ensureCan('chat', 'create');
        $meId = (int) $request->user()->id;
        $this->ensureParticipant($conversation, $meId);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:4000'],
        ]);

        $body = trim($data['body']);
        abort_if($body === '', 422, 'Pesan kosong.');

        $message = DB::transaction(function () use ($conversation, $meId, $body) {
            $message = Message::query()->create([
                'company_id' => $conversation->company_id,
                'conversation_id' => $conversation->id,
                'user_id' => $meId,
                'body' => $body,
            ]);

            $conversation->update(['last_message_at' => now()]);

            ConversationParticipant::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $meId)
                ->update(['last_read_at' => now()]);

            return $message;
        });

        $message->load('user:id,name,avatar');

        return $this->ok($this->serializeMessage($message), [], 201);
    }

    public function markRead(Request $request, Conversation $conversation): JsonResponse
    {
        $this->ensureCan('chat', 'view');
        $meId = (int) $request->user()->id;
        $this->ensureParticipant($conversation, $meId);

        ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $meId)
            ->update(['last_read_at' => now()]);

        return $this->ok(['ok' => true]);
    }

    private function ensureParticipant(Conversation $conversation, int $userId): void
    {
        $ok = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $userId)
            ->exists();

        abort_unless($ok, 403, 'Bukan peserta percakapan.');
    }

    /**
     * @param  array<int, array{is_online: bool, last_seen_at: ?string}>  $presence
     * @return array<string, mixed>
     */
    private function serializeConversation(Conversation $conversation, int $meId, array $presence = []): array
    {
        $peer = $conversation->participants
            ->first(fn (ConversationParticipant $p) => (int) $p->user_id !== $meId)
            ?->user;

        $mine = $conversation->participants
            ->first(fn (ConversationParticipant $p) => (int) $p->user_id === $meId);

        $last = $conversation->latestMessage;
        $unread = 0;
        if ($mine) {
            $unreadQuery = Message::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', '!=', $meId);
            if ($mine->last_read_at) {
                $unreadQuery->where('created_at', '>', $mine->last_read_at);
            }
            $unread = (int) $unreadQuery->count();
        }

        $peerPresence = $peer ? ($presence[(int) $peer->id] ?? null) : null;

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'title' => $conversation->title,
            'peer' => $peer ? $this->serializeUser($peer, $peerPresence) : null,
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
                ? $this->serializeUser($message->user)
                : null,
        ];
    }

    /**
     * @param  array{is_online: bool, last_seen_at: ?string}|null  $presence
     * @return array{id: int, name: string, email: ?string, username: ?string, avatar: ?string, is_online: bool, last_seen_at: ?string}
     */
    private function serializeUser(User $user, ?array $presence = null): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'avatar' => $user->avatarUrl(),
            'is_online' => (bool) ($presence['is_online'] ?? false),
            'last_seen_at' => $presence['last_seen_at'] ?? null,
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, CompanyUser>  $memberships
     * @return array<int, array{is_online: bool, last_seen_at: ?string}>
     */
    private function presenceMap($memberships): array
    {
        $cutoff = now()->subSeconds(self::ONLINE_WINDOW_SECONDS);
        $map = [];

        foreach ($memberships as $row) {
            $seen = $row->last_seen_at;
            $map[(int) $row->user_id] = [
                'is_online' => $seen !== null && $seen->greaterThanOrEqualTo($cutoff),
                'last_seen_at' => optional($seen)?->toIso8601String(),
            ];
        }

        return $map;
    }
}
