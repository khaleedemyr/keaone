<?php

namespace App\Services;

use App\Models\Storefront;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class RajaOngkirService
{
    public function apiKeyFor(Storefront $storefront): ?string
    {
        $fallback = trim((string) config('rajaongkir.api_key', ''));

        return $fallback !== '' ? $fallback : null;
    }

    public function isConfigured(Storefront $storefront): bool
    {
        $shipping = is_array($storefront->shipping) ? $storefront->shipping : [];
        if (! ($shipping['enabled'] ?? false)) {
            return false;
        }
        if (empty($shipping['origin_id'])) {
            return false;
        }

        return $this->apiKeyFor($storefront) !== null;
    }

    /**
     * @return list<array{id: int, label: string, subdistrict_name?: string|null, district_name?: string|null, city_name?: string|null, province_name?: string|null, zip_code?: string|null}>
     */
    public function searchDestinations(Storefront $storefront, string $search, int $limit = 20): array
    {
        $key = $this->apiKeyFor($storefront);
        if (! $key) {
            throw ValidationException::withMessages([
                'shipping' => 'API key RajaOngkir belum dikonfigurasi.',
            ]);
        }

        $search = trim($search);
        if (mb_strlen($search) < 2) {
            return [];
        }

        $response = Http::withHeaders(['key' => $key])
            ->timeout((int) config('rajaongkir.timeout', 20))
            ->acceptJson()
            ->get($this->url('/destination/domestic-destination'), [
                'search' => $search,
                'limit' => max(1, min(50, $limit)),
                'offset' => 0,
            ]);

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                'shipping' => $this->errorMessage($response->json(), 'Gagal mencari destinasi ongkir.'),
            ]);
        }

        $rows = $response->json('data');
        if (! is_array($rows)) {
            return [];
        }

        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $id = (int) ($row['id'] ?? 0);
            if ($id <= 0) {
                continue;
            }
            $label = $this->formatDestinationLabel($row);
            $out[] = [
                'id' => $id,
                'label' => $label,
                'subdistrict_name' => $row['subdistrict_name'] ?? $row['suburb_name'] ?? null,
                'district_name' => $row['district_name'] ?? null,
                'city_name' => $row['city_name'] ?? null,
                'province_name' => $row['province_name'] ?? null,
                'zip_code' => isset($row['zip_code']) ? (string) $row['zip_code'] : null,
            ];
        }

        return $out;
    }

    /**
     * @param  list<string>|string  $couriers
     * @return list<array{name: string, code: string, service: string, description: string, cost: int, etd: string|null}>
     */
    public function calculateDomesticCost(
        Storefront $storefront,
        int $destinationId,
        int $weightGram,
        array|string $couriers = [],
        string $price = 'lowest',
    ): array {
        $key = $this->apiKeyFor($storefront);
        if (! $key) {
            throw ValidationException::withMessages([
                'shipping' => 'API key RajaOngkir belum dikonfigurasi.',
            ]);
        }

        $shipping = is_array($storefront->shipping) ? $storefront->shipping : [];
        $originId = (int) ($shipping['origin_id'] ?? 0);
        if ($originId <= 0) {
            throw ValidationException::withMessages([
                'shipping' => 'Asal pengiriman (origin) belum diisi di Setup toko.',
            ]);
        }
        if ($destinationId <= 0) {
            throw ValidationException::withMessages([
                'destination_id' => 'Destinasi pengiriman wajib dipilih.',
            ]);
        }

        $weightGram = max(1, min(30000, $weightGram));
        $courierParam = $this->normalizeCourierParam($couriers, $shipping);

        $response = Http::asForm()
            ->withHeaders(['key' => $key])
            ->timeout((int) config('rajaongkir.timeout', 20))
            ->acceptJson()
            ->post($this->url('/calculate/domestic-cost'), [
                'origin' => $originId,
                'destination' => $destinationId,
                'weight' => $weightGram,
                'courier' => $courierParam,
                'price' => in_array($price, ['lowest', 'highest'], true) ? $price : 'lowest',
            ]);

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                'shipping' => $this->errorMessage($response->json(), 'Gagal menghitung ongkir.'),
            ]);
        }

        $rows = $response->json('data');
        if (! is_array($rows)) {
            return [];
        }

        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $cost = (int) ($row['cost'] ?? $row['price'] ?? 0);
            $code = strtolower(trim((string) ($row['code'] ?? '')));
            $service = trim((string) ($row['service'] ?? ''));
            if ($code === '' || $service === '') {
                continue;
            }
            $out[] = [
                'name' => (string) ($row['name'] ?? strtoupper($code)),
                'code' => $code,
                'service' => $service,
                'description' => (string) ($row['description'] ?? $service),
                'cost' => max(0, $cost),
                'etd' => isset($row['etd']) ? trim((string) $row['etd']) : null,
            ];
        }

        usort($out, fn ($a, $b) => $a['cost'] <=> $b['cost']);

        return $out;
    }

    /**
     * @param  array<string, mixed>  $option
     * @return array{name: string, code: string, service: string, description: string, cost: int, etd: string|null}
     */
    public function findMatchingOption(array $options, string $courier, string $service): ?array
    {
        $courier = strtolower(trim($courier));
        $service = strtoupper(trim($service));
        foreach ($options as $option) {
            if (! is_array($option)) {
                continue;
            }
            if (strtolower((string) ($option['code'] ?? '')) !== $courier) {
                continue;
            }
            if (strtoupper((string) ($option['service'] ?? '')) !== $service) {
                continue;
            }

            return [
                'name' => (string) ($option['name'] ?? strtoupper($courier)),
                'code' => strtolower((string) $option['code']),
                'service' => (string) $option['service'],
                'description' => (string) ($option['description'] ?? $option['service']),
                'cost' => max(0, (int) ($option['cost'] ?? 0)),
                'etd' => isset($option['etd']) ? (string) $option['etd'] : null,
            ];
        }

        return null;
    }

    private function url(string $path): string
    {
        return rtrim((string) config('rajaongkir.base_url'), '/').'/'.ltrim($path, '/');
    }

    /**
     * @param  list<string>|string  $couriers
     * @param  array<string, mixed>  $shipping
     */
    private function normalizeCourierParam(array|string $couriers, array $shipping): string
    {
        if (is_string($couriers) && trim($couriers) !== '') {
            return strtolower(trim($couriers));
        }

        $list = is_array($couriers) ? $couriers : [];
        if ($list === [] && is_array($shipping['couriers'] ?? null)) {
            $list = $shipping['couriers'];
        }
        if ($list === []) {
            $list = config('rajaongkir.default_couriers', ['jne', 'sicepat', 'jnt']);
        }

        $clean = [];
        foreach ($list as $code) {
            $code = strtolower(trim((string) $code));
            if ($code !== '' && preg_match('/^[a-z0-9]+$/', $code)) {
                $clean[] = $code;
            }
        }
        $clean = array_values(array_unique($clean));
        if ($clean === []) {
            $clean = ['jne'];
        }

        return implode(':', $clean);
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function formatDestinationLabel(array $row): string
    {
        $parts = array_filter([
            $row['subdistrict_name'] ?? $row['suburb_name'] ?? null,
            $row['district_name'] ?? null,
            $row['city_name'] ?? null,
            $row['province_name'] ?? null,
            isset($row['zip_code']) ? (string) $row['zip_code'] : null,
        ], fn ($v) => is_string($v) && trim($v) !== '');

        if ($parts !== []) {
            return implode(', ', $parts);
        }

        return (string) ($row['label'] ?? $row['name'] ?? ('ID '.$row['id']));
    }

    /**
     * @param  mixed  $json
     */
    private function errorMessage($json, string $fallback): string
    {
        if (! is_array($json)) {
            return $fallback;
        }
        $meta = $json['meta'] ?? null;
        if (is_array($meta) && ! empty($meta['message'])) {
            return (string) $meta['message'];
        }
        if (! empty($json['message'])) {
            return (string) $json['message'];
        }

        return $fallback;
    }
}
