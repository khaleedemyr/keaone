<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ProcurementPlan;
use App\Services\ProcurementPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProcurementPlanController extends Controller
{
    public function __construct(private ProcurementPlanService $plans) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureCan('procurementplans', 'view');
        $this->plans->assertEnabled();

        $query = ProcurementPlan::query()->orderByDesc('fiscal_year')->orderByDesc('id');

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
            $page->getCollection()->map(fn (ProcurementPlan $row) => $this->plans->serialize($row))->values(),
            $this->pageMeta($page),
        );
    }

    public function show(ProcurementPlan $procurementPlan): JsonResponse
    {
        $this->ensureCan('procurementplans', 'view');
        $this->plans->assertEnabled();

        return $this->ok($this->plans->serialize($procurementPlan));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan('procurementplans', 'create');

        $data = $request->validate(array_merge(ProcurementPlan::headerRules(), [
            'client_uuid' => ['required', 'uuid'],
            'lines' => ['nullable', 'array'],
            'lines.*.product_id' => ['required', 'integer'],
            'lines.*.period_month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'lines.*.qty_planned' => ['required', 'integer', 'min:1'],
            'lines.*.estimated_unit_cost' => ['nullable', 'integer', 'min:0'],
            'lines.*.note' => ['nullable', 'string', 'max:255'],
        ]));

        $lines = $data['lines'] ?? [];
        unset($data['lines']);

        $plan = ProcurementPlan::query()->create(array_merge($data, [
            'user_id' => $request->user()->id,
            'status' => 'draft',
        ]));

        if ($lines !== []) {
            $this->plans->syncLines($plan, $lines);
        }

        return $this->ok($this->plans->serialize($plan->fresh()), [], 201);
    }

    public function update(Request $request, ProcurementPlan $procurementPlan): JsonResponse
    {
        $this->ensureCan('procurementplans', 'edit');
        $this->plans->assertEnabled();

        if ($procurementPlan->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Rencana hanya bisa diubah saat draft.']]);
        }

        $data = $request->validate(array_merge(ProcurementPlan::headerRules(true), [
            'lines' => ['sometimes', 'array'],
            'lines.*.product_id' => ['required_with:lines', 'integer'],
            'lines.*.period_month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'lines.*.qty_planned' => ['required_with:lines', 'integer', 'min:1'],
            'lines.*.estimated_unit_cost' => ['nullable', 'integer', 'min:0'],
            'lines.*.note' => ['nullable', 'string', 'max:255'],
        ]));

        if (array_key_exists('lines', $data)) {
            $lines = $data['lines'];
            unset($data['lines']);
            $procurementPlan->update($data);
            $this->plans->syncLines($procurementPlan, $lines ?? []);
        } else {
            $procurementPlan->update($data);
        }

        return $this->ok($this->plans->serialize($procurementPlan->fresh()));
    }

    public function destroy(ProcurementPlan $procurementPlan): JsonResponse
    {
        $this->ensureCan('procurementplans', 'delete');

        if ($procurementPlan->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Hanya rencana draft yang bisa dihapus.']]);
        }

        $procurementPlan->delete();

        return $this->ok(null);
    }

    public function activate(ProcurementPlan $procurementPlan): JsonResponse
    {
        $this->ensureCan('procurementplans', 'edit');

        return $this->ok($this->plans->serialize($this->plans->activate($procurementPlan)));
    }

    public function close(ProcurementPlan $procurementPlan): JsonResponse
    {
        $this->ensureCan('procurementplans', 'edit');

        return $this->ok($this->plans->serialize($this->plans->close($procurementPlan)));
    }
}
