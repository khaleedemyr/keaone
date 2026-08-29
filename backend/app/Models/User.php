<?php

namespace App\Models;

use App\Support\LangCatalog;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name',
    'username',
    'email',
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
    'employee_photo',
    'ktp_document',
    'kk_document',
    'avatar',
    'password',
    'is_active',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'birth_date' => 'date',
            'password' => 'hashed',
            'is_platform' => 'boolean',
            'is_active' => 'boolean',
            'preferences' => 'array',
        ];
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(CompanyUser::class);
    }

    public function issueToken(string $name = 'web', bool $remember = true): string
    {
        $expiresAt = $remember ? now()->addDays(30) : now()->addHours(12);
        $token = $this->createToken($name, ['*'], $expiresAt)->plainTextToken;

        $keep = $this->tokens()->latest('id')->limit(10)->pluck('id');
        if ($keep->isNotEmpty()) {
            $this->tokens()->whereNotIn('id', $keep)->delete();
        }

        return $token;
    }

    public function avatarUrl(): ?string
    {
        if (! is_string($this->avatar) || $this->avatar === '') {
            return null;
        }

        $file = basename($this->avatar);
        if (! preg_match('/^[A-Za-z0-9._-]+$/', $file)) {
            return null;
        }

        return '/media/avatars/'.$file;
    }

    /**
     * @return array{theme: string, lang: string, wallpaper: array{kind: string, id: string, src?: string}}
     */
    public static function defaultPreferences(): array
    {
        return [
            'theme' => 'dark',
            'lang' => 'id',
            'uiSkin' => 'auto',
            'wallpaper' => [
                'kind' => 'preset',
                'id' => 'aurora',
            ],
            'desktop' => [
                'showIcons' => true,
                'hiddenApps' => [],
                'iconPositions' => [],
                'widgets' => [
                    'hidden' => [],
                    'positions' => [],
                    'clockSkin' => 'classic',
                    'stickyNotes' => [
                        ['id' => 'note_default', 'text' => '', 'color' => 'mint'],
                    ],
                    'weatherCity' => '',
                ],
            ],
        ];
    }

    /**
     * @return array{theme: string, lang: string, wallpaper: array{kind: string, id: string, src?: string}}|null
     */
    public function publicPreferences(): ?array
    {
        if ($this->preferences === null) {
            return null;
        }

        $defaults = self::defaultPreferences();
        $saved = $this->preferences;
        $theme = $saved['theme'] ?? null;
        $lang = $saved['lang'] ?? null;
        $wallpaper = is_array($saved['wallpaper'] ?? null) ? $saved['wallpaper'] : [];
        $kind = ($wallpaper['kind'] ?? '') === 'image' ? 'image' : 'preset';
        $id = is_string($wallpaper['id'] ?? null) && $wallpaper['id'] !== '' ? $wallpaper['id'] : $defaults['wallpaper']['id'];
        $src = is_string($wallpaper['src'] ?? null) ? $wallpaper['src'] : null;

        $normalized = [
            'theme' => in_array($theme, ['dark', 'light'], true) ? $theme : $defaults['theme'],
            'lang' => LangCatalog::isValid($lang) ? $lang : $defaults['lang'],
            'uiSkin' => in_array($saved['uiSkin'] ?? null, ['auto', 'desktop', 'erp'], true)
                ? $saved['uiSkin']
                : $defaults['uiSkin'],
            'wallpaper' => [
                'kind' => $kind,
                'id' => $id,
            ],
        ];

        if ($kind === 'image' && is_string($src) && $src !== '' && ! str_starts_with($src, 'data:') && ! str_starts_with($src, 'blob:')) {
            $normalized['wallpaper']['src'] = $src;
        }

        $desktop = is_array($saved['desktop'] ?? null) ? $saved['desktop'] : [];
        $hiddenApps = [];
        foreach ($desktop['hiddenApps'] ?? [] as $appId) {
            if (is_string($appId) && $appId !== '' && strlen($appId) <= 32) {
                $hiddenApps[] = $appId;
            }
        }
        $iconPositions = [];
        foreach ($desktop['iconPositions'] ?? [] as $appId => $pos) {
            if (! is_string($appId) || $appId === '' || strlen($appId) > 32 || ! is_array($pos)) {
                continue;
            }
            $x = $pos['x'] ?? null;
            $y = $pos['y'] ?? null;
            if (! is_numeric($x) || ! is_numeric($y)) {
                continue;
            }
            $iconPositions[$appId] = [
                'x' => max(0, (int) round((float) $x)),
                'y' => max(0, (int) round((float) $y)),
            ];
        }
        $normalized['desktop'] = [
            'showIcons' => ($desktop['showIcons'] ?? true) !== false,
            'hiddenApps' => array_values(array_unique($hiddenApps)),
            'iconPositions' => $iconPositions,
            'widgets' => self::normalizeDesktopWidgets(is_array($desktop['widgets'] ?? null) ? $desktop['widgets'] : []),
        ];

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $widgets
     * @return array{hidden: list<string>, positions: array<string, array{x: int, y: int}>, clockSkin: string, stickyNotes: list<array{id: string, text: string, color: string}>, weatherCity: string}
     */
    private static function normalizeDesktopWidgets(array $widgets): array
    {
        $allowedWidgets = ['clock', 'store', 'weather', 'notes'];
        $hidden = [];
        foreach ($widgets['hidden'] ?? [] as $id) {
            if (is_string($id) && in_array($id, $allowedWidgets, true)) {
                $hidden[] = $id;
            }
        }

        $positions = [];
        foreach ($widgets['positions'] ?? [] as $id => $pos) {
            if (! is_string($id) || $id === '' || strlen($id) > 48 || ! is_array($pos)) {
                continue;
            }
            if (! in_array($id, $allowedWidgets, true) && ! str_starts_with($id, 'note:')) {
                continue;
            }
            $x = $pos['x'] ?? null;
            $y = $pos['y'] ?? null;
            if (! is_numeric($x) || ! is_numeric($y)) {
                continue;
            }
            $positions[$id] = [
                'x' => max(0, (int) round((float) $x)),
                'y' => max(0, (int) round((float) $y)),
            ];
        }

        $clockSkin = is_string($widgets['clockSkin'] ?? null) ? $widgets['clockSkin'] : 'classic';
        if (! in_array($clockSkin, ['classic', 'minimal', 'neon', 'flip', 'analog', 'watch', 'wall', 'chrome'], true)) {
            $clockSkin = 'classic';
        }

        $stickyNotes = [];
        if (is_array($widgets['stickyNotes'] ?? null)) {
            foreach (array_slice($widgets['stickyNotes'], 0, 12) as $note) {
                if (! is_array($note) || ! is_string($note['id'] ?? null) || $note['id'] === '') {
                    continue;
                }
                $color = is_string($note['color'] ?? null) ? $note['color'] : 'mint';
                if (! in_array($color, ['mint', 'gold', 'rose', 'sky'], true)) {
                    $color = 'mint';
                }
                $stickyNotes[] = [
                    'id' => mb_substr($note['id'], 0, 40),
                    'text' => is_string($note['text'] ?? null) ? mb_substr($note['text'], 0, 2000) : '',
                    'color' => $color,
                ];
            }
        }

        if ($stickyNotes === []) {
            $legacyColor = is_string($widgets['notesColor'] ?? null) ? $widgets['notesColor'] : 'mint';
            if (! in_array($legacyColor, ['mint', 'gold', 'rose', 'sky'], true)) {
                $legacyColor = 'mint';
            }
            $legacyText = is_string($widgets['notesText'] ?? null) ? mb_substr($widgets['notesText'], 0, 2000) : '';
            $stickyNotes[] = [
                'id' => 'note_default',
                'text' => $legacyText,
                'color' => $legacyColor,
            ];
        }

        $weatherCity = is_string($widgets['weatherCity'] ?? null) ? mb_substr($widgets['weatherCity'], 0, 80) : '';

        return [
            'hidden' => array_values(array_unique($hidden)),
            'positions' => $positions,
            'clockSkin' => $clockSkin,
            'stickyNotes' => $stickyNotes,
            'weatherCity' => $weatherCity,
        ];
    }
}
