<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Services\CustomFieldService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class TypedContactController extends Controller
{
    abstract protected function menuKey(): string;

    abstract protected function contactType(): string;

    public function index(Request $request): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'view');

        $type = $this->contactType();
        $query = Contact::query()
            ->where(function ($q) use ($type) {
                $q->where('type', $type)->orWhere('type', 'both');
            })
            ->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhere('npwp', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'create');

        $data = $this->validated($request);
        $data['type'] = $this->contactType();
        $contact = Contact::query()->create($data);

        return $this->ok($contact, [], 201);
    }

    public function update(Request $request, Contact $contact): JsonResponse
    {
        $this->ensureCan($this->menuKey(), 'edit');
        $this->assertType($contact);

        $contact->update($this->validated($request, true));

        return $this->ok($contact->fresh());
    }

    public function destroy(Contact $contact): JsonResponse
    {
        $this->ensureCanAny([[$this->menuKey(), 'delete'], [$this->menuKey(), 'edit']]);
        $this->assertType($contact);
        $contact->update(['is_active' => false]);

        return $this->ok($contact->fresh());
    }

    private function assertType(Contact $contact): void
    {
        abort_unless(in_array($contact->type, [$this->contactType(), 'both'], true), 404);
    }

    private function validated(Request $request, bool $update = false): array
    {
        $data = $request->validate(Contact::profileRules($update));
        if (array_key_exists('custom_fields', $data) || ! $update) {
            $data['custom_fields'] = app(CustomFieldService::class)
                ->normalize($this->contactType(), $data['custom_fields'] ?? []);
        }

        return $data;
    }
}
