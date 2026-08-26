<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reminder extends Model
{
    protected $fillable = ['user_id', 'title', 'note', 'remind_on', 'remind_at'];

    protected function casts(): array
    {
        return [
            'remind_on' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array{id: int, title: string, note: string|null, remind_on: string, remind_at: string|null}
     */
    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'note' => $this->note,
            'remind_on' => $this->remind_on?->toDateString(),
            'remind_at' => $this->remind_at ? substr((string) $this->remind_at, 0, 5) : null,
        ];
    }
}
