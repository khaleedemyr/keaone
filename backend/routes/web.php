<?php

use Illuminate\Support\Facades\Route;

Route::get('/media/wallpapers/{file}', function (string $file) {
    abort_unless(preg_match('/^[A-Za-z0-9._-]+$/', $file) === 1, 404);
    $path = storage_path('app/public/wallpapers/'.$file);
    abort_unless(is_file($path), 404);

    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mime = match ($ext) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        default => abort(404),
    };

    return response()->file($path, [
        'Content-Type' => $mime,
        'X-Content-Type-Options' => 'nosniff',
        'Cache-Control' => 'public, max-age=31536000, immutable',
    ]);
});

Route::get('/media/avatars/{file}', function (string $file) {
    abort_unless(preg_match('/^[A-Za-z0-9._-]+$/', $file) === 1, 404);
    $path = storage_path('app/public/avatars/'.$file);
    abort_unless(is_file($path), 404);

    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mime = match ($ext) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => abort(404),
    };

    return response()->file($path, [
        'Content-Type' => $mime,
        'X-Content-Type-Options' => 'nosniff',
        'Cache-Control' => 'public, max-age=31536000, immutable',
    ]);
});

Route::get('/media/logos/{file}', function (string $file) {
    abort_unless(preg_match('/^[A-Za-z0-9._-]+$/', $file) === 1, 404);
    $path = storage_path('app/public/logos/'.$file);
    abort_unless(is_file($path), 404);

    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mime = match ($ext) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => abort(404),
    };

    return response()->file($path, [
        'Content-Type' => $mime,
        'X-Content-Type-Options' => 'nosniff',
        'Cache-Control' => 'public, max-age=31536000, immutable',
    ]);
});

Route::get('/media/products/{file}', function (string $file) {
    abort_unless(preg_match('/^[A-Za-z0-9._-]+$/', $file) === 1, 404);
    $path = storage_path('app/public/products/'.$file);
    abort_unless(is_file($path), 404);

    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mime = match ($ext) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => abort(404),
    };

    return response()->file($path, [
        'Content-Type' => $mime,
        'X-Content-Type-Options' => 'nosniff',
        'Cache-Control' => 'public, max-age=31536000, immutable',
    ]);
});

Route::get('/media/blog/{file}', function (string $file) {
    abort_unless(preg_match('/^[A-Za-z0-9._-]+$/', $file) === 1, 404);
    $path = storage_path('app/public/blog/'.$file);
    abort_unless(is_file($path), 404);

    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mime = match ($ext) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => abort(404),
    };

    return response()->file($path, [
        'Content-Type' => $mime,
        'X-Content-Type-Options' => 'nosniff',
        'Cache-Control' => 'public, max-age=31536000, immutable',
    ]);
});

/** Serve React SPA for non-API routes (shared hosting / production). */
Route::get('/{any?}', function () {
    $spa = public_path('index.html');
    abort_unless(is_file($spa), 404);

    return response()->file($spa, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'no-cache',
    ]);
})->where('any', '.*');
