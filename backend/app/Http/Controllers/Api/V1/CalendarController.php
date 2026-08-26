<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Reminder;
use App\Support\HolidayCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $year = (int) $request->integer('year', now()->year);
        $year = max(2024, min(2032, $year));

        $reminders = Reminder::query()
            ->where('user_id', $request->user()->id)
            ->whereYear('remind_on', $year)
            ->orderBy('remind_on')
            ->orderBy('remind_at')
            ->get()
            ->map(fn (Reminder $row) => $row->toPayload())
            ->values();

        return $this->ok([
            'year' => $year,
            'holidays' => HolidayCatalog::forYear($year),
            'reminders' => $reminders,
        ]);
    }

    public function storeReminder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'note' => ['nullable', 'string', 'max:500'],
            'remind_on' => ['required', 'date'],
            'remind_at' => ['nullable', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
        ]);

        $count = Reminder::query()->where('user_id', $request->user()->id)->count();
        abort_unless($count < 200, 422, 'Terlalu banyak pengingat.');

        $remindAt = $data['remind_at'] ?? null;
        if (is_string($remindAt) && $remindAt !== '') {
            $remindAt = substr($remindAt, 0, 5);
        } else {
            $remindAt = null;
        }

        $reminder = Reminder::query()->create([
            'user_id' => $request->user()->id,
            'title' => $data['title'],
            'note' => $data['note'] ?? null,
            'remind_on' => $data['remind_on'],
            'remind_at' => $remindAt,
        ]);

        return $this->ok($reminder->toPayload(), [], 201);
    }

    public function destroyReminder(Request $request, Reminder $reminder): JsonResponse
    {
        abort_unless($reminder->user_id === $request->user()->id, 403);

        $reminder->delete();

        return $this->ok(['ok' => true]);
    }
}
