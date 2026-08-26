<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use Carbon\Carbon;

class BillingService
{
    public function defaultPlan(): Plan
    {
        return Plan::query()->where('is_default', true)->where('is_active', true)->first()
            ?? Plan::query()->where('is_active', true)->orderBy('sort_order')->firstOrFail();
    }

    public function startTrial(Company $company, ?Plan $plan = null): Subscription
    {
        $plan ??= $this->defaultPlan();
        $days = max(0, (int) $plan->trial_days);
        $trialEnd = $days > 0 ? now()->addDays($days) : now();

        $subscription = Subscription::query()->updateOrCreate(
            ['company_id' => $company->id],
            [
                'plan_id' => $plan->id,
                'status' => $days > 0 ? 'trialing' : 'active',
                'billing_cycle' => 'monthly',
                'trial_ends_at' => $days > 0 ? $trialEnd : null,
                'current_period_end' => $trialEnd,
            ],
        );

        $this->applyPlanModules($company, $plan);

        return $subscription->load('plan');
    }

    public function refresh(Subscription $subscription): Subscription
    {
        if ($subscription->status === 'canceled') {
            return $subscription;
        }

        $ended = $subscription->current_period_end && $subscription->current_period_end->isPast();
        $trialEnded = $subscription->status === 'trialing'
            && $subscription->trial_ends_at
            && $subscription->trial_ends_at->isPast();

        if (($ended || $trialEnded) && $subscription->status !== 'past_due') {
            $subscription->update(['status' => 'past_due']);
            $this->issueIfMissing($subscription->fresh(['plan', 'company']));
        }

        return $subscription->fresh(['plan']);
    }

    public function subscribe(Company $company, Plan $plan, string $cycle = 'monthly'): Subscription
    {
        $subscription = $company->subscription ?? $this->startTrial($company, $plan);
        $price = $plan->priceFor($cycle);

        $subscription->fill([
            'plan_id' => $plan->id,
            'billing_cycle' => $cycle === 'yearly' ? 'yearly' : 'monthly',
        ]);

        if ($price <= 0) {
            $subscription->status = 'active';
            $subscription->current_period_end = $this->nextPeriodEnd($cycle);
            $subscription->save();
            $this->applyPlanModules($company, $plan);

            return $subscription->fresh(['plan']);
        }

        if ($subscription->status === 'trialing' && $subscription->trial_ends_at?->isFuture()) {
            $subscription->save();
            $this->applyPlanModules($company, $plan);

            return $subscription->fresh(['plan']);
        }

        $subscription->status = 'past_due';
        $subscription->save();
        $this->applyPlanModules($company, $plan);
        $this->issueIfMissing($subscription->fresh(['plan', 'company']));

        return $subscription->fresh(['plan']);
    }

    public function assign(Company $company, Plan $plan, string $cycle = 'monthly', bool $activate = false): Subscription
    {
        $subscription = $company->subscription ?? $this->startTrial($company, $plan);
        $end = $this->nextPeriodEnd($cycle);

        $subscription->update([
            'plan_id' => $plan->id,
            'billing_cycle' => $cycle === 'yearly' ? 'yearly' : 'monthly',
            'status' => $activate ? 'active' : $subscription->status,
            'current_period_end' => $activate ? $end : $subscription->current_period_end,
        ]);

        $this->applyPlanModules($company, $plan);

        return $subscription->fresh(['plan']);
    }

    public function issueIfMissing(Subscription $subscription): ?Invoice
    {
        $open = Invoice::query()
            ->where('company_id', $subscription->company_id)
            ->where('status', 'issued')
            ->exists();

        if ($open) {
            return null;
        }

        return $this->issue($subscription);
    }

    public function issue(Subscription $subscription, ?string $note = null): Invoice
    {
        $plan = $subscription->plan ?? $this->defaultPlan();
        $cycle = $subscription->billing_cycle === 'yearly' ? 'yearly' : 'monthly';
        $start = now();
        $end = $this->nextPeriodEnd($cycle, $start);
        $invoice = Invoice::query()->create([
            'company_id' => $subscription->company_id,
            'plan_id' => $plan->id,
            'number' => 'TMP-'.uniqid(),
            'amount' => $plan->priceFor($cycle),
            'status' => 'issued',
            'billing_cycle' => $cycle,
            'period_start' => $start,
            'period_end' => $end,
            'due_at' => now()->addDays(7),
            'note' => $note,
        ]);
        $invoice->update([
            'number' => 'INV-'.$start->format('Y').'-'.str_pad((string) $invoice->id, 5, '0', STR_PAD_LEFT),
        ]);

        return $invoice->fresh(['plan', 'company']);
    }

    public function markPaid(Invoice $invoice): Invoice
    {
        if ($invoice->status === 'paid') {
            return $invoice;
        }

        $invoice->update([
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        $subscription = Subscription::query()->where('company_id', $invoice->company_id)->first();
        if ($subscription) {
            $cycle = $invoice->billing_cycle ?: $subscription->billing_cycle;
            $subscription->update([
                'status' => 'active',
                'plan_id' => $invoice->plan_id ?: $subscription->plan_id,
                'billing_cycle' => $cycle,
                'current_period_end' => $invoice->period_end ?: $this->nextPeriodEnd($cycle),
            ]);
            if ($subscription->plan) {
                $company = Company::query()->find($invoice->company_id);
                if ($company) {
                    $this->applyPlanModules($company, $subscription->plan);
                }
            }
        }

        return $invoice->fresh(['plan', 'company']);
    }

    public function applyPlanModules(Company $company, Plan $plan): void
    {
        $allowed = $plan->allowedModules();
        $stored = $company->modules ?? [];
        $next = [];

        foreach ($company->defaultModules() as $key => $defaultOn) {
            $planAllows = (bool) ($allowed[$key] ?? false);
            if (! $planAllows) {
                $next[$key] = false;

                continue;
            }

            // Keep tenant offs; new keys default to plan (on).
            $next[$key] = array_key_exists($key, $stored) ? (bool) $stored[$key] : true;
        }

        $company->modules = $next;
        $company->save();
    }

    public function snapshot(?Company $company): ?array
    {
        if (! $company) {
            return null;
        }

        $subscription = $company->subscription;
        if (! $subscription) {
            return null;
        }

        $subscription = $this->refresh($subscription);
        $plan = $subscription->plan;

        return [
            'status' => $subscription->status,
            'billing_cycle' => $subscription->billing_cycle,
            'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
            'current_period_end' => $subscription->current_period_end?->toIso8601String(),
            'usable' => $subscription->isUsable(),
            'plan' => $plan ? $this->serializePlan($plan) : null,
        ];
    }

    public function serializePlan(Plan $plan): array
    {
        return [
            'id' => $plan->id,
            'slug' => $plan->slug,
            'name' => $plan->name,
            'price_monthly' => $plan->price_monthly,
            'price_yearly' => $plan->price_yearly,
            'trial_days' => $plan->trial_days,
            'max_users' => $plan->max_users,
            'max_outlets' => $plan->max_outlets,
            'modules' => $plan->allowedModules(),
            'is_default' => $plan->is_default,
            'is_active' => $plan->is_active,
            'sort_order' => $plan->sort_order,
        ];
    }

    public function serializeInvoice(Invoice $invoice): array
    {
        return [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'amount' => $invoice->amount,
            'status' => $invoice->status,
            'billing_cycle' => $invoice->billing_cycle,
            'period_start' => $invoice->period_start?->toIso8601String(),
            'period_end' => $invoice->period_end?->toIso8601String(),
            'due_at' => $invoice->due_at?->toIso8601String(),
            'paid_at' => $invoice->paid_at?->toIso8601String(),
            'note' => $invoice->note,
            'plan' => $invoice->plan ? [
                'id' => $invoice->plan->id,
                'name' => $invoice->plan->name,
            ] : null,
            'company' => $invoice->company ? [
                'id' => $invoice->company->id,
                'name' => $invoice->company->name,
            ] : null,
        ];
    }

    private function nextPeriodEnd(string $cycle, ?Carbon $from = null): Carbon
    {
        $from ??= now();

        return $cycle === 'yearly' ? $from->copy()->addYear() : $from->copy()->addMonth();
    }
}
