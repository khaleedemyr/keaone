<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BlogPost extends Model
{
    protected $fillable = [
        'cover_path',
        'status',
        'published_at',
        'author_id',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    public function translations(): HasMany
    {
        return $this->hasMany(BlogPostTranslation::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function coverUrl(): ?string
    {
        if (! $this->cover_path) {
            return null;
        }

        $file = basename($this->cover_path);

        return '/media/blog/'.$file;
    }

    public function isPublished(): bool
    {
        return $this->status === 'published'
            && $this->published_at
            && $this->published_at->lte(now());
    }

    public function translationFor(string $locale): ?BlogPostTranslation
    {
        $rows = $this->relationLoaded('translations')
            ? $this->translations
            : $this->translations()->get();

        return $rows->firstWhere('locale', $locale)
            ?? $rows->firstWhere('locale', 'id')
            ?? $rows->firstWhere('locale', 'en')
            ?? $rows->first();
    }
}
