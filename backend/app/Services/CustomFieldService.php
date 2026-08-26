<?php

namespace App\Services;

use App\Models\CustomFieldDefinition;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CustomFieldService
{
    /**
     * @return Collection<int, CustomFieldDefinition>
     */
    public function activeFor(string $entity): Collection
    {
        return CustomFieldDefinition::query()
            ->where('entity', $entity)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }

    /**
     * Normalize & validate custom field payload against active definitions.
     *
     * @param  array<string, mixed>|null  $input
     * @return array<string, mixed>
     */
    public function normalize(string $entity, ?array $input): array
    {
        $defs = $this->activeFor($entity);
        $input = is_array($input) ? $input : [];
        $out = [];
        $errors = [];

        foreach ($defs as $def) {
            $raw = $input[$def->key] ?? null;
            $hasValue = ! ($raw === null || $raw === '');

            if (! $hasValue) {
                if ($def->is_required) {
                    $errors["custom_fields.{$def->key}"] = ["{$def->label} wajib diisi."];
                }
                continue;
            }

            try {
                $out[$def->key] = $this->castValue($def, $raw);
            } catch (\InvalidArgumentException $e) {
                $errors["custom_fields.{$def->key}"] = [$e->getMessage()];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $out;
    }

    private function castValue(CustomFieldDefinition $def, mixed $raw): mixed
    {
        return match ($def->type) {
            'boolean' => filter_var($raw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $raw,
            'number' => $this->asNumber($def->label, $raw),
            'date' => $this->asDate($def->label, $raw),
            'select' => $this->asSelect($def, $raw),
            'textarea', 'text' => trim((string) $raw),
            default => trim((string) $raw),
        };
    }

    private function asNumber(string $label, mixed $raw): float|int
    {
        if (! is_numeric($raw)) {
            throw new \InvalidArgumentException("{$label} harus angka.");
        }
        $num = $raw + 0;

        return is_float($num) && floor($num) == $raw ? (int) $raw : $num;
    }

    private function asDate(string $label, mixed $raw): string
    {
        $value = trim((string) $raw);
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            throw new \InvalidArgumentException("{$label} harus format tanggal YYYY-MM-DD.");
        }

        return $value;
    }

    private function asSelect(CustomFieldDefinition $def, mixed $raw): string
    {
        $value = trim((string) $raw);
        $options = array_map('strval', $def->options ?? []);
        if ($options !== [] && ! in_array($value, $options, true)) {
            throw new \InvalidArgumentException("{$def->label} tidak valid.");
        }

        return $value;
    }

    public static function makeKey(string $label): string
    {
        $key = strtolower(trim($label));
        $key = preg_replace('/[^a-z0-9]+/', '_', $key) ?? '';
        $key = trim($key, '_');
        if ($key === '') {
            $key = 'field';
        }

        return substr($key, 0, 64);
    }
}
