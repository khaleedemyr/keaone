<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserNotification;
use App\Support\CurrentCompany;

class NotificationService
{
    /**
     * @param  array<string, string|int|float|null>  $params
     * @param  array<string, mixed>  $meta
     */
    public function notify(
        int $userId,
        string $titleKey,
        string $bodyKey,
        array $params = [],
        array $meta = [],
        string $tone = 'info',
        ?int $companyId = null,
    ): ?UserNotification {
        $companyId ??= CurrentCompany::id();
        if (! $companyId || $userId < 1) {
            return null;
        }

        $cleanParams = [];
        foreach ($params as $key => $value) {
            if ($value === null) {
                continue;
            }
            $cleanParams[(string) $key] = is_scalar($value) ? (string) $value : json_encode($value);
        }

        return UserNotification::query()->create([
            'company_id' => $companyId,
            'user_id' => $userId,
            'tone' => $tone,
            'title_key' => $titleKey,
            'body_key' => $bodyKey,
            'params' => $cleanParams,
            'meta' => $meta ?: null,
        ]);
    }

    public function serialize(UserNotification $row): array
    {
        return [
            'id' => $row->id,
            'tone' => $row->tone,
            'title_key' => $row->title_key,
            'body_key' => $row->body_key,
            'params' => $row->params ?? [],
            'meta' => $row->meta ?? null,
            'read_at' => $row->read_at?->toIso8601String(),
            'created_at' => $row->created_at?->toIso8601String(),
            'at' => $row->created_at?->getTimestampMs() ?? (int) round(microtime(true) * 1000),
        ];
    }
}
