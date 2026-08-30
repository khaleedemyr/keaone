<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Services\BudgetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BudgetController extends Controller
{
    public function __construct(private BudgetService $budgets) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('procurementbudgets', 'view');

        $query = Budget::query()->orderByDesc('period_start')->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($year = $request->integer('fiscal_year')) {
            $query->where('fiscal_year', $year);
        }

        if ($search = $request->string('search')->toString()) {
            $query->where('name', 'like', "%{$search}%");
        }

        $page = $query->paginate($this->perPage($request, 20));

        return $this->ok(
            $page->getCollection()->map(fn (Budget $row) => $this->budgets->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function show(Budget $budget): JsonResponse
    {
        $this->ensureCan('procurementbudgets', 'view');

        return $this->ok($this->budgets->serialize($budget));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('procurementbudgets', 'create');

        $data = $request->validate(array_merge(Budget::headerRules(), [
            'lines' => ['nullable', 'array'],
            'lines.*.department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'lines.*.outlet_id' => ['nullable', 'integer', 'exists:outlets,id'],
            'lines.*.amount' => ['required', 'integer', 'min:0'],
            'lines.*.note' => ['nullable', 'string', 'max:255'],
        ]));

        $lines = $data['lines'] ?? [];
        unset($data['lines']);

        $budget = Budget::query()->create(array_merge($data, ['status' => 'draft']));
        if ($lines !== []) {
            $this->budgets->syncLines($budget, $lines);
        }

        return $this->ok($this->budgets->serialize($budget->fresh()), [], 201);
    }

    public function update(Request $request, Budget $budget): JsonResponse
    {
        $this->ensureCan('procurementbudgets', 'edit');

        if ($budget->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Anggaran hanya bisa diubah saat draft.']]);
        }

        $data = $request->validate(array_merge(Budget::headerRules(true), [
            'lines' => ['sometimes', 'array'],
            'lines.*.department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'lines.*.outlet_id' => ['nullable', 'integer', 'exists:outlets,id'],
            'lines.*.amount' => ['required', 'integer', 'min:0'],
            'lines.*.note' => ['nullable', 'string', 'max:255'],
        ]));

        if (array_key_exists('lines', $data)) {
            $lines = $data['lines'];
            unset($data['lines']);
            $budget->update($data);
            $this->budgets->syncLines($budget, $lines ?? []);
        } else {
            $budget->update($data);
        }

        return $this->ok($this->budgets->serialize($budget->fresh()));
    }

    public function destroy(Budget $budget): JsonResponse
    {
        $this->ensureCan('procurementbudgets', 'delete');

        if ($budget->status === 'active') {
            throw ValidationException::withMessages(['status' => ['Nonaktifkan anggaran aktif terlebih dahulu.']]);
        }

        if ($budget->commitments()->where('status', 'active')->exists()) {
            throw ValidationException::withMessages(['budget' => ['Anggaran masih memiliki komitmen aktif.']]);
        }

        $budget->lines()->delete();
        $budget->delete();

        return $this->ok(['deleted' => true]);
    }

    public function activate(Budget $budget): JsonResponse
    {
        $this->ensureCan('procurementbudgets', 'edit');

        return $this->ok($this->budgets->serialize($this->budgets->activate($budget)));
    }

    public function close(Budget $budget): JsonResponse
    {
        $this->ensureCan('procurementbudgets', 'edit');

        return $this->ok($this->budgets->serialize($this->budgets->close($budget)));
    }

    public function commitments(Request $request, Budget $budget): JsonResponse
    {
        $this->ensureCan('procurementbudgets', 'view');

        $query = $budget->commitments()->orderByDesc('committed_at');

        if ($status = $request->string('status')->toString()) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        $page = $query->paginate($this->perPage($request, 50));

        return $this->ok(
            $page->getCollection()->map(fn ($row) => [
                'id' => $row->id,
                'source_type' => $row->source_type,
                'source_id' => $row->source_id,
                'source_number' => $row->source_number,
                'amount' => (int) $row->amount,
                'status' => $row->status,
                'committed_at' => $row->committed_at?->toIso8601String(),
                'released_at' => $row->released_at?->toIso8601String(),
            ])->values(),
            $this->pageMeta($page),
        );
    }
}
