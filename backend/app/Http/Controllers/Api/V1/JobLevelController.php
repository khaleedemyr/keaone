<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JobLevel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobLevelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('for_select')) {
            $this->ensureCanAny(['joblevels', 'users']);
        } else {
            $this->ensureCan('joblevels', 'view');
        }

        $query = JobLevel::query()->orderBy('rank')->orderBy('sort_order')->orderBy('name');

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $this->applyActiveStatus($query, $request);

        return $this->paged($query, $request);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('joblevels', 'create');

        $jobLevel = JobLevel::query()->create($this->validated($request));

        return $this->ok($jobLevel, [], 201);
    }

    public function update(Request $request, JobLevel $jobLevel): JsonResponse
    {
        $this->ensureCan('joblevels', 'edit');

        $jobLevel->update($this->validated($request, true));

        return $this->ok($jobLevel->fresh());
    }

    public function destroy(JobLevel $jobLevel): JsonResponse
    {
        $this->ensureCanAny([['joblevels', 'delete'], ['joblevels', 'edit']]);
        $jobLevel->update(['is_active' => false]);

        return $this->ok($jobLevel->fresh());
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:40'],
            'rank' => ['nullable', 'integer', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
