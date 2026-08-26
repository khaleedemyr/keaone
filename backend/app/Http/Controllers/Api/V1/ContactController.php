<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContactController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('contacts', 'view');

        $query = Contact::query()->orderBy('name');

        if ($type = $request->string('type')->toString()) {
            $query->where(function ($q) use ($type) {
                $q->where('type', $type)->orWhere('type', 'both');
            });
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        if ($request->boolean('for_select')) {
            return $this->ok($query->limit(200)->get());
        }

        $page = $query->paginate($this->perPage($request));

        return $this->ok($page->items(), $this->pageMeta($page));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('contacts', 'create');

        $contact = Contact::query()->create($this->validated($request));

        return $this->ok($contact, [], 201);
    }

    public function show(Contact $contact): JsonResponse
    {
        return $this->ok($contact);
    }

    public function update(Request $request, Contact $contact): JsonResponse
    {
        $this->ensureCan('contacts', 'edit');

        $contact->update($this->validated($request, true));

        return $this->ok($contact->fresh());
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'type' => [$update ? 'sometimes' : 'required', Rule::in(['customer', 'supplier', 'both'])],
            ...Contact::profileRules($update),
        ]);
    }
}
