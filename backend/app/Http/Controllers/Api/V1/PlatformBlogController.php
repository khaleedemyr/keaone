<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\BlogPostTranslation;
use App\Support\LangCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlatformBlogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('blog', 'view');

        $search = trim($request->string('search')->toString());
        $status = $request->string('status')->toString();

        $query = BlogPost::query()->with(['translations', 'author:id,name,email']);

        if (in_array($status, ['draft', 'published'], true)) {
            $query->where('status', $status);
        }

        if ($search !== '') {
            $query->whereHas('translations', function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $rows = $query->orderByDesc('updated_at')->paginate($this->perPage($request));

        return $this->ok(
            collect($rows->items())->map(fn (BlogPost $post) => $this->serializeAdmin($post))->values(),
            $this->pageMeta($rows),
        );
    }

    public function show(BlogPost $blogPost): JsonResponse
    {
        $this->ensurePlatformCan('blog', 'view');
        $blogPost->load(['translations', 'author:id,name,email']);

        return $this->ok($this->serializeAdmin($blogPost));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensurePlatformCan('blog', 'create');

        $data = $this->validated($request);
        $post = DB::transaction(function () use ($data, $request) {
            $post = BlogPost::query()->create([
                'status' => $data['status'],
                'published_at' => $data['status'] === 'published'
                    ? ($data['published_at'] ?? now())
                    : null,
                'author_id' => $request->user()->id,
            ]);
            $this->syncTranslations($post, $data['translations']);

            return $post->load(['translations', 'author:id,name,email']);
        });

        return $this->ok($this->serializeAdmin($post), [], 201);
    }

    public function update(Request $request, BlogPost $blogPost): JsonResponse
    {
        $this->ensurePlatformCan('blog', 'edit');

        $data = $this->validated($request, $blogPost->id);
        DB::transaction(function () use ($blogPost, $data) {
            $status = $data['status'];
            $publishedAt = $blogPost->published_at;
            if ($status === 'published') {
                $publishedAt = $data['published_at'] ?? $publishedAt ?? now();
            } elseif ($status === 'draft') {
                $publishedAt = $data['published_at'] ?? $publishedAt;
            }

            $blogPost->update([
                'status' => $status,
                'published_at' => $publishedAt,
            ]);
            $this->syncTranslations($blogPost, $data['translations']);
        });

        return $this->ok($this->serializeAdmin($blogPost->fresh(['translations', 'author:id,name,email'])));
    }

    public function destroy(BlogPost $blogPost): JsonResponse
    {
        $this->ensurePlatformCan('blog', 'delete');

        if ($blogPost->cover_path) {
            $file = storage_path('app/public/blog/'.basename($blogPost->cover_path));
            if (is_file($file)) {
                @unlink($file);
            }
        }

        $blogPost->delete();

        return $this->ok(['ok' => true]);
    }

    public function storeCover(Request $request, BlogPost $blogPost): JsonResponse
    {
        $this->ensurePlatformCan('blog', 'edit');

        $request->validate([
            'file' => ['required', 'file', 'image', 'max:8192'],
        ]);

        $uploaded = $request->file('file');
        abort_unless($uploaded && $uploaded->isValid(), 422, 'Unggahan cover gagal.');

        $info = @getimagesize($uploaded->getRealPath() ?: $uploaded->getPathname());
        abort_unless($info !== false, 422, 'File bukan gambar yang valid.');

        $ext = match ($info[2] ?? 0) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        };
        abort_unless($ext, 422, 'Format gambar tidak didukung. Pakai JPG, PNG, atau WebP.');

        $dir = storage_path('app/public/blog');
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            abort(500, 'Tidak bisa membuat folder blog.');
        }

        if ($blogPost->cover_path) {
            $old = $dir.DIRECTORY_SEPARATOR.basename($blogPost->cover_path);
            if (is_file($old)) {
                @unlink($old);
            }
        }

        $name = $blogPost->id.'_'.Str::uuid().'.'.$ext;
        $uploaded->move($dir, $name);
        abort_unless(is_file($dir.DIRECTORY_SEPARATOR.$name), 422, 'Tidak bisa menyimpan cover.');

        $blogPost->forceFill(['cover_path' => 'blog/'.$name])->save();

        return $this->ok($this->serializeAdmin($blogPost->fresh(['translations', 'author:id,name,email'])));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?int $postId = null): array
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
            'translations' => ['required', 'array', 'min:1'],
            'translations.*.locale' => ['required', Rule::in(LangCatalog::ALL)],
            'translations.*.title' => ['required', 'string', 'max:200'],
            'translations.*.slug' => ['nullable', 'string', 'max:200'],
            'translations.*.excerpt' => ['nullable', 'string', 'max:500'],
            'translations.*.body' => ['nullable', 'string', 'max:100000'],
        ]);

        $seen = [];
        foreach ($data['translations'] as $i => $row) {
            $locale = $row['locale'];
            abort_if(isset($seen[$locale]), 422, "Locale {$locale} duplikat.");
            $seen[$locale] = true;

            $slug = trim((string) ($row['slug'] ?? ''));
            if ($slug === '') {
                $slug = Str::slug($row['title']);
            }
            $slug = Str::slug($slug) ?: 'post-'.Str::random(6);
            $data['translations'][$i]['slug'] = $slug;

            $exists = BlogPostTranslation::query()
                ->where('locale', $locale)
                ->where('slug', $slug)
                ->when($postId, fn ($q) => $q->where('blog_post_id', '!=', $postId))
                ->exists();
            abort_if($exists, 422, "Slug \"{$slug}\" sudah dipakai untuk locale {$locale}.");
        }

        return $data;
    }

    /**
     * @param  list<array{locale: string, title: string, slug: string, excerpt?: ?string, body?: ?string}>  $rows
     */
    private function syncTranslations(BlogPost $post, array $rows): void
    {
        $keepLocales = [];
        foreach ($rows as $row) {
            $keepLocales[] = $row['locale'];
            BlogPostTranslation::query()->updateOrCreate(
                [
                    'blog_post_id' => $post->id,
                    'locale' => $row['locale'],
                ],
                [
                    'title' => $row['title'],
                    'slug' => $row['slug'],
                    'excerpt' => $row['excerpt'] ?? null,
                    'body' => $row['body'] ?? null,
                ],
            );
        }

        BlogPostTranslation::query()
            ->where('blog_post_id', $post->id)
            ->whereNotIn('locale', $keepLocales)
            ->delete();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeAdmin(BlogPost $post): array
    {
        return [
            'id' => $post->id,
            'status' => $post->status,
            'published_at' => optional($post->published_at)?->toIso8601String(),
            'cover' => $post->coverUrl(),
            'cover_path' => $post->cover_path,
            'author' => $post->author ? [
                'id' => $post->author->id,
                'name' => $post->author->name,
                'email' => $post->author->email,
            ] : null,
            'translations' => $post->translations
                ->sortBy('locale')
                ->values()
                ->map(fn (BlogPostTranslation $tr) => [
                    'locale' => $tr->locale,
                    'title' => $tr->title,
                    'slug' => $tr->slug,
                    'excerpt' => $tr->excerpt,
                    'body' => $tr->body,
                ])
                ->all(),
            'updated_at' => optional($post->updated_at)?->toIso8601String(),
            'created_at' => optional($post->created_at)?->toIso8601String(),
        ];
    }
}
