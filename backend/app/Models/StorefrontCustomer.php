<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;

class StorefrontCustomer extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'company_id',
        'storefront_id',
        'contact_id',
        'name',
        'email',
        'phone',
        'password',
        'address',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(StorefrontOrder::class, 'contact_id', 'contact_id');
    }

    public function issueToken(string $name = 'storefront', bool $remember = true): string
    {
        $expiresAt = $remember ? now()->addDays(30) : now()->addHours(12);
        $token = $this->createToken($name, ['storefront-customer'], $expiresAt)->plainTextToken;

        $keep = $this->tokens()->latest('id')->limit(8)->pluck('id');
        if ($keep->isNotEmpty()) {
            $this->tokens()->whereNotIn('id', $keep)->delete();
        }

        return $token;
    }

    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'contact_id' => $this->contact_id,
        ];
    }

    public static function verifyPassword(self $customer, string $password): bool
    {
        return Hash::check($password, $customer->password);
    }
}
