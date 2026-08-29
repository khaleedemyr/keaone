<?php

namespace App\Support;

use Illuminate\Validation\Rule;

class EmployeeProfile
{
    /**
     * @return array<string, mixed>
     */
    public static function rules(bool $required = false): array
    {
        $req = $required ? 'required' : 'nullable';

        return [
            'phone' => [$req, 'string', 'max:30'],
            'national_id' => [$req, 'string', 'max:16', 'regex:/^\d+$/'],
            'tax_id' => ['nullable', 'string', 'max:25'],
            'birth_date' => [$req, 'date'],
            'birth_place' => [$req, 'string', 'max:120'],
            'gender' => [$req, 'string', Rule::in(['male', 'female'])],
            'marital_status' => ['nullable', 'string', Rule::in(['single', 'married', 'divorced', 'widowed'])],
            'address' => [$req, 'string', 'max:500'],
            'emergency_contact_name' => [$req, 'string', 'max:120'],
            'emergency_contact_phone' => [$req, 'string', 'max:30'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function validated(array $data): array
    {
        $fields = [];

        foreach ([
            'phone',
            'national_id',
            'tax_id',
            'birth_date',
            'birth_place',
            'gender',
            'marital_status',
            'address',
            'emergency_contact_name',
            'emergency_contact_phone',
        ] as $key) {
            if (! array_key_exists($key, $data)) {
                continue;
            }

            $value = $data[$key];
            if (in_array($key, ['phone', 'national_id', 'tax_id', 'birth_place', 'address', 'emergency_contact_name', 'emergency_contact_phone'], true)) {
                $fields[$key] = $value !== null && $value !== '' ? $value : null;
                continue;
            }
            if ($key === 'birth_date') {
                $fields[$key] = $value !== null && $value !== '' ? $value : null;
                continue;
            }
            if (in_array($key, ['gender', 'marital_status'], true)) {
                $fields[$key] = $value !== null && $value !== '' ? $value : null;
                continue;
            }
            $fields[$key] = $value;
        }

        return $fields;
    }
}
