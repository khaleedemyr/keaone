<?php

namespace App\Support;

class ReceiptLayout
{
    public const KINDS = [
        'logo', 'company', 'outlet', 'address', 'phone', 'divider', 'number', 'datetime',
        'cashier', 'channel', 'items', 'totals', 'payments', 'footer', 'text', 'spacer',
    ];

    /**
     * @param  array<string, mixed>  $settings
     * @return array{width: int, blocks: list<array<string, mixed>>}
     */
    public static function default(array $settings = []): array
    {
        $footer = (string) ($settings['receipt_footer'] ?? 'Terima kasih');
        $width = (int) ($settings['receipt_width'] ?? 80);

        return [
            'width' => in_array($width, [58, 80], true) ? $width : 80,
            'blocks' => [
                self::block('logo', 'logo', true, 'center', 'md'),
                self::block('company', 'company', true, 'center', 'lg', true),
                self::block('outlet', 'outlet', true, 'center', 'sm'),
                self::block('address', 'address', true, 'center', 'sm'),
                self::block('phone', 'phone', true, 'center', 'sm'),
                self::block('div-1', 'divider', true),
                self::block('number', 'number', true, 'left', 'md', true),
                self::block('datetime', 'datetime', true, 'left', 'sm'),
                self::block('cashier', 'cashier', true, 'left', 'sm'),
                self::block('channel', 'channel', false, 'left', 'sm'),
                self::block('div-2', 'divider', true),
                self::block('items', 'items', true),
                self::block('div-3', 'divider', true),
                self::block('totals', 'totals', true),
                self::block('payments', 'payments', false),
                self::block('footer', 'footer', true, 'center', 'sm', false, $footer),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array{width: int, blocks: list<array<string, mixed>>}
     */
    public static function normalize(mixed $layout, array $settings = []): array
    {
        $base = self::default($settings);
        if (! is_array($layout)) {
            return $base;
        }

        $width = (int) ($layout['width'] ?? $base['width']);
        $width = max(58, min(112, $width));

        $blocks = [];
        foreach (array_values($layout['blocks'] ?? []) as $index => $row) {
            if (! is_array($row)) {
                continue;
            }
            $kind = (string) ($row['kind'] ?? '');
            if (! in_array($kind, self::KINDS, true)) {
                continue;
            }
            $align = $row['align'] ?? 'left';
            $size = $row['size'] ?? 'md';
            $blocks[] = [
                'id' => substr((string) ($row['id'] ?? $kind.'-'.$index), 0, 40),
                'kind' => $kind,
                'enabled' => (bool) ($row['enabled'] ?? true),
                'align' => in_array($align, ['left', 'center', 'right'], true) ? $align : 'left',
                'size' => in_array($size, ['sm', 'md', 'lg'], true) ? $size : 'md',
                'bold' => (bool) ($row['bold'] ?? false),
                'text' => array_key_exists('text', $row) ? mb_substr((string) $row['text'], 0, 500) : null,
            ];
            if (count($blocks) >= 40) {
                break;
            }
        }

        if ($blocks === []) {
            $blocks = $base['blocks'];
        } elseif (! self::hasKind($blocks, 'logo')) {
            array_unshift($blocks, self::block('logo', 'logo', true, 'center', 'md'));
            $blocks = array_slice($blocks, 0, 40);
        }

        return [
            'width' => $width,
            'blocks' => $blocks,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $blocks
     */
    private static function hasKind(array $blocks, string $kind): bool
    {
        foreach ($blocks as $row) {
            if (($row['kind'] ?? '') === $kind) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private static function block(
        string $id,
        string $kind,
        bool $enabled,
        string $align = 'left',
        string $size = 'md',
        bool $bold = false,
        ?string $text = null,
    ): array {
        return [
            'id' => $id,
            'kind' => $kind,
            'enabled' => $enabled,
            'align' => $align,
            'size' => $size,
            'bold' => $bold,
            'text' => $text,
        ];
    }
}
