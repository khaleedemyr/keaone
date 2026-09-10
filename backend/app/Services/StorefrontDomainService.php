<?php

namespace App\Services;

use App\Models\Storefront;
use App\Models\StorefrontDomain;
use App\Support\StorefrontCatalog;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StorefrontDomainService
{
    public function connect(Storefront $storefront, string $rawHost, bool $isPrimary = true): StorefrontDomain
    {
        $host = StorefrontCatalog::normalizeHost($rawHost);

        if (! StorefrontCatalog::isValidHost($host)) {
            throw ValidationException::withMessages([
                'host' => 'Format domain tidak valid.',
            ]);
        }

        $taken = StorefrontDomain::query()
            ->withoutGlobalScopes()
            ->where('host', $host)
            ->where('storefront_id', '!=', $storefront->id)
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages([
                'host' => 'Domain sudah dipakai company lain.',
            ]);
        }

        try {
            return DB::transaction(function () use ($storefront, $host, $isPrimary) {
                $existing = StorefrontDomain::query()
                    ->where('storefront_id', $storefront->id)
                    ->where('host', $host)
                    ->first();

                if ($existing) {
                    $domain = $existing;
                    if (empty($domain->dns_instructions['verification_token'] ?? null)) {
                        $domain->dns_instructions = $this->buildDnsInstructions($domain);
                        $domain->save();
                    }
                } else {
                    $domain = StorefrontDomain::query()->create([
                        'company_id' => $storefront->company_id,
                        'storefront_id' => $storefront->id,
                        'host' => $host,
                        'status' => 'pending_dns',
                        'acquisition' => 'connect',
                        'dns_instructions' => null,
                        'ssl_status' => 'pending',
                        'is_primary' => $isPrimary,
                    ]);
                    $domain->dns_instructions = $this->buildDnsInstructions($domain);
                    $domain->save();
                }

                if ($isPrimary) {
                    StorefrontDomain::query()
                        ->where('storefront_id', $storefront->id)
                        ->where('id', '!=', $domain->id)
                        ->update(['is_primary' => false]);
                    $domain->is_primary = true;
                    $domain->save();
                }

                return $domain->fresh();
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'host' => 'Domain sudah dipakai company lain.',
            ]);
        }
    }

    public function verify(StorefrontDomain $domain): StorefrontDomain
    {
        if (empty($domain->dns_instructions['verification_token'] ?? null)) {
            $domain->dns_instructions = $this->buildDnsInstructions($domain);
            $domain->save();
        }

        $pointingOk = $this->dnsMatches($domain->host);
        $ownershipOk = $this->txtChallengeMatches($domain);
        $ok = $pointingOk && $ownershipOk;

        // Local/testing without DNS targets: allow verify for UI testing.
        if (! $ok && app()->environment('local', 'testing')) {
            $targetHost = strtolower((string) config('storefront.dns_target_host', ''));
            $targetIps = config('storefront.dns_target_ips', []) ?: [];
            if ($targetHost === '' && (! is_array($targetIps) || $targetIps === [])) {
                $ok = true;
            }
        }

        $domain->status = $ok ? 'active' : 'failed';
        $domain->verified_at = $ok ? now() : null;
        if ($ok && $domain->ssl_status === 'pending') {
            $domain->ssl_status = 'pending';
        }
        $domain->dns_instructions = $this->buildDnsInstructions($domain);
        $domain->save();

        return $domain->fresh();
    }

    /**
     * @return array{
     *   cname: string,
     *   a_records: list<string>,
     *   note: string,
     *   verification_token: string,
     *   txt_host: string,
     *   txt_value: string
     * }
     */
    public function buildDnsInstructions(StorefrontDomain $domain): array
    {
        $base = StorefrontCatalog::dnsInstructions();
        $existing = is_array($domain->dns_instructions) ? $domain->dns_instructions : [];
        $token = (string) ($existing['verification_token'] ?? '');
        if ($token === '') {
            $token = 'kea_'.Str::lower(Str::random(24));
        }

        $txtHost = '_keaone-challenge.'.$domain->host;
        $txtValue = 'keaone-verify='.$token;

        return [
            'cname' => $base['cname'],
            'a_records' => $base['a_records'],
            'verification_token' => $token,
            'txt_host' => $txtHost,
            'txt_value' => $txtValue,
            'note' => '1) Arahkan domain (CNAME/A) ke KEA One. 2) Tambah TXT di '.$txtHost.' bernilai '.$txtValue.'. 3) Klik Verifikasi setelah DNS menyebar.',
        ];
    }

    public function txtChallengeMatches(StorefrontDomain $domain): bool
    {
        $token = (string) ($domain->dns_instructions['verification_token'] ?? '');
        if ($token === '') {
            return false;
        }

        $needle = 'keaone-verify='.$token;
        $hosts = [
            '_keaone-challenge.'.$domain->host,
            $domain->host,
        ];

        foreach ($hosts as $checkHost) {
            $records = @dns_get_record($checkHost, DNS_TXT) ?: [];
            foreach ($records as $row) {
                $txt = strtolower(trim((string) ($row['txt'] ?? '')));
                if ($txt === strtolower($needle) || str_contains($txt, strtolower($needle))) {
                    return true;
                }
            }
        }

        return false;
    }

    public function dnsMatches(string $host): bool
    {
        $targetHost = strtolower((string) config('storefront.dns_target_host', ''));
        $targetIps = array_map('strtolower', config('storefront.dns_target_ips', []) ?: []);

        if ($targetHost === '' && $targetIps === []) {
            return app()->environment('local', 'testing');
        }

        $cnameOk = false;
        if ($targetHost !== '') {
            $records = @dns_get_record($host, DNS_CNAME) ?: [];
            foreach ($records as $row) {
                $target = strtolower(rtrim((string) ($row['target'] ?? ''), '.'));
                if ($target === rtrim($targetHost, '.')) {
                    $cnameOk = true;
                    break;
                }
            }
        }

        $aOk = false;
        if ($targetIps !== []) {
            $records = @dns_get_record($host, DNS_A) ?: [];
            foreach ($records as $row) {
                $ip = strtolower((string) ($row['ip'] ?? ''));
                if (in_array($ip, $targetIps, true)) {
                    $aOk = true;
                    break;
                }
            }
        }

        return $cnameOk || $aOk;
    }

    public function findByHost(string $rawHost): ?StorefrontDomain
    {
        $host = StorefrontCatalog::normalizeHost($rawHost);
        if ($host === '') {
            return null;
        }

        return StorefrontDomain::query()
            ->withoutGlobalScopes()
            ->where('host', $host)
            ->where('status', 'active')
            ->first();
    }

    /**
     * @return array{
     *   host: string,
     *   status: string,
     *   can_connect: bool,
     *   can_purchase: bool,
     *   registered: bool|null,
     *   message: string,
     *   dns_instructions: array{cname: string, a_records: list<string>, note: string}
     * }
     */
    public function check(Storefront $storefront, string $rawHost): array
    {
        $host = StorefrontCatalog::normalizeHost($rawHost);
        $instructions = StorefrontCatalog::dnsInstructions();

        if (! StorefrontCatalog::isValidHost($host)) {
            return [
                'host' => $host,
                'status' => 'invalid',
                'can_connect' => false,
                'can_purchase' => false,
                'registered' => null,
                'message' => 'Format domain tidak valid. Contoh: tokoanda.com',
                'dns_instructions' => $instructions,
            ];
        }

        $mine = StorefrontDomain::query()
            ->where('storefront_id', $storefront->id)
            ->where('host', $host)
            ->exists();

        if ($mine) {
            return [
                'host' => $host,
                'status' => 'owned_by_you',
                'can_connect' => true,
                'can_purchase' => false,
                'registered' => true,
                'message' => 'Domain ini sudah terhubung ke toko Anda. Lanjutkan verifikasi DNS bila belum aktif.',
                'dns_instructions' => $instructions,
            ];
        }

        $taken = StorefrontDomain::query()
            ->withoutGlobalScopes()
            ->where('host', $host)
            ->where('storefront_id', '!=', $storefront->id)
            ->exists();

        if ($taken) {
            return [
                'host' => $host,
                'status' => 'taken_keaone',
                'can_connect' => false,
                'can_purchase' => false,
                'registered' => true,
                'message' => 'Domain sudah dipakai company lain di Keaone. Pilih nama lain.',
                'dns_instructions' => $instructions,
            ];
        }

        $registered = $this->looksRegistered($host);

        if ($registered === true) {
            return [
                'host' => $host,
                'status' => 'registered',
                'can_connect' => true,
                'can_purchase' => false,
                'registered' => true,
                'message' => 'Domain sudah terdaftar. Jika ini milik Anda, hubungkan lalu arahkan DNS + TXT challenge ke Keaone.',
                'dns_instructions' => $instructions,
            ];
        }

        if ($registered === false) {
            return [
                'host' => $host,
                'status' => 'available',
                'can_connect' => false,
                'can_purchase' => true,
                'registered' => false,
                'message' => 'Domain sepertinya masih tersedia. Pembelian otomatis segera hadir; untuk sekarang hubungkan domain yang sudah Anda miliki.',
                'dns_instructions' => $instructions,
            ];
        }

        return [
            'host' => $host,
            'status' => 'unknown',
            'can_connect' => true,
            'can_purchase' => false,
            'registered' => null,
            'message' => 'Tidak bisa memastikan status registrasi. Jika domain milik Anda, tetap bisa dihubungkan.',
            'dns_instructions' => $instructions,
        ];
    }

    public function looksRegistered(string $host): ?bool
    {
        $ns = @dns_get_record($host, DNS_NS) ?: [];
        if ($ns !== []) {
            return true;
        }

        $soa = @dns_get_record($host, DNS_SOA) ?: [];
        if ($soa !== []) {
            return true;
        }

        $a = @dns_get_record($host, DNS_A) ?: [];
        $aaaa = @dns_get_record($host, DNS_AAAA) ?: [];
        $cname = @dns_get_record($host, DNS_CNAME) ?: [];
        if ($a !== [] || $aaaa !== [] || $cname !== []) {
            return true;
        }

        $probe = dns_get_record($host, DNS_NS);
        if ($probe === false) {
            return null;
        }

        return false;
    }
}
