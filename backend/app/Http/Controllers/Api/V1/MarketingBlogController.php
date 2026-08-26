<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\BlogPostTranslation;
use App\Support\LangCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarketingBlogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $lang = $this->resolveLang($request);
        $limit = min(max($request->integer('limit', 12), 1), 50);

        $posts = BlogPost::query()
            ->with('translations')
            ->where('status', 'published')
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->orderByDesc('published_at')
            ->limit($limit)
            ->get()
            ->map(fn (BlogPost $post) => $this->serializePublic($post, $lang, false))
            ->filter()
            ->values();

        return $this->ok($posts);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $lang = $this->resolveLang($request);

        $translation = BlogPostTranslation::query()
            ->where('slug', $slug)
            ->whereHas('post', function ($q) {
                $q->where('status', 'published')
                    ->whereNotNull('published_at')
                    ->where('published_at', '<=', now());
            })
            ->with('post.translations')
            ->first();

        abort_unless($translation, 404, 'Artikel tidak ditemukan.');

        $post = $translation->post;
        $payload = $this->serializePublic($post, $lang, true);
        abort_unless($payload, 404, 'Artikel tidak ditemukan.');

        $related = BlogPost::query()
            ->with('translations')
            ->where('status', 'published')
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->where('id', '!=', $post->id)
            ->orderByDesc('published_at')
            ->limit(3)
            ->get()
            ->map(fn (BlogPost $row) => $this->serializePublic($row, $lang, false))
            ->filter()
            ->values();

        $payload['related'] = $related;

        return $this->ok($payload);
    }

    private function resolveLang(Request $request): string
    {
        $lang = $request->string('lang')->toString();

        return LangCatalog::isValid($lang) ? $lang : 'id';
    }

    /**
     * @return array<string, mixed>|null
     */
    private function serializePublic(BlogPost $post, string $lang, bool $withBody): ?array
    {
        $tr = $post->translationFor($lang);
        if (! $tr) {
            return null;
        }

        $data = [
            'id' => $post->id,
            'slug' => $tr->slug,
            'locale' => $tr->locale,
            'title' => $tr->title,
            'excerpt' => $tr->excerpt,
            'cover' => $post->coverUrl(),
            'published_at' => optional($post->published_at)?->toIso8601String(),
        ];

        if ($withBody) {
            $data['body'] = $tr->body ?? '';
        }

        return $data;
    }
}
