<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MySqlPartitions
{
    public static function enabled(): bool
    {
        return Schema::getConnection()->getDriverName() === 'mysql';
    }

    public static function isPartitioned(string $table): bool
    {
        if (! self::enabled()) {
            return false;
        }

        $db = Schema::getConnection()->getDatabaseName();
        $row = DB::selectOne(
            'SELECT COUNT(*) AS c FROM information_schema.PARTITIONS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND PARTITION_NAME IS NOT NULL',
            [$db, $table],
        );

        return ((int) ($row->c ?? 0)) > 0;
    }

    /**
     * @return list<string>
     */
    public static function partitionNames(string $table): array
    {
        if (! self::enabled()) {
            return [];
        }

        $db = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.PARTITIONS')
            ->where('TABLE_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->whereNotNull('PARTITION_NAME')
            ->orderBy('PARTITION_ORDINAL_POSITION')
            ->pluck('PARTITION_NAME')
            ->map(fn ($name) => (string) $name)
            ->all();
    }

    public static function monthlyDefinitions(Carbon $start, Carbon $end): string
    {
        $parts = [];
        $cursor = $start->copy()->startOfMonth();
        $end = $end->copy()->startOfMonth();

        while ($cursor <= $end) {
            $name = 'p'.$cursor->format('Ym');
            $next = $cursor->copy()->addMonth();
            $parts[] = sprintf(
                "PARTITION %s VALUES LESS THAN (TO_DAYS('%s'))",
                $name,
                $next->format('Y-m-d'),
            );
            $cursor = $next;
        }

        $parts[] = 'PARTITION pmax VALUES LESS THAN MAXVALUE';

        return implode(",\n", $parts);
    }

    public static function window(): array
    {
        $back = max(0, (int) config('partitions.months_back', 3));
        $ahead = max(3, (int) config('partitions.months_ahead', 15));

        return [
            Carbon::now()->subMonths($back)->startOfMonth(),
            Carbon::now()->addMonths($ahead)->startOfMonth(),
        ];
    }

    public static function dropForeignKeys(string $table): void
    {
        if (! self::enabled()) {
            return;
        }

        $db = Schema::getConnection()->getDatabaseName();
        $constraints = DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->pluck('CONSTRAINT_NAME');

        foreach ($constraints as $name) {
            DB::statement(sprintf('ALTER TABLE `%s` DROP FOREIGN KEY `%s`', $table, $name));
        }
    }

    public static function dropIndexIfExists(string $table, string $index): void
    {
        if (! self::enabled()) {
            return;
        }

        $db = Schema::getConnection()->getDatabaseName();
        $exists = DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $index)
            ->exists();

        if ($exists) {
            DB::statement(sprintf('ALTER TABLE `%s` DROP INDEX `%s`', $table, $index));
        }
    }

    public static function applyRangeByCreatedAt(string $table): void
    {
        if (! self::enabled() || self::isPartitioned($table)) {
            return;
        }

        [$from, $to] = self::window();
        $definitions = self::monthlyDefinitions($from, $to);

        DB::statement(sprintf(
            'ALTER TABLE `%s` PARTITION BY RANGE (TO_DAYS(`created_at`)) (%s)',
            $table,
            $definitions,
        ));
    }

    public static function ensureMonthPartition(string $table, Carbon $month): bool
    {
        if (! self::enabled() || ! self::isPartitioned($table)) {
            return false;
        }

        $name = 'p'.$month->format('Ym');
        if (in_array($name, self::partitionNames($table), true)) {
            return false;
        }

        $next = $month->copy()->addMonth()->format('Y-m-d');
        DB::statement(sprintf(
            'ALTER TABLE `%s` REORGANIZE PARTITION pmax INTO (
                PARTITION %s VALUES LESS THAN (TO_DAYS(\'%s\')),
                PARTITION pmax VALUES LESS THAN MAXVALUE
            )',
            $table,
            $name,
            $next,
        ));

        return true;
    }

    /**
     * Drop monthly partitions wholly before the cutoff (retention tables only).
     */
    public static function dropPartitionsBefore(string $table, Carbon $cutoff): int
    {
        if (! self::enabled() || ! self::isPartitioned($table)) {
            return 0;
        }

        $dropped = 0;
        foreach (self::partitionNames($table) as $name) {
            if ($name === 'pmax' || ! preg_match('/^p(\d{6})$/', $name, $m)) {
                continue;
            }

            $month = Carbon::createFromFormat('Ym', $m[1])->endOfMonth();
            if ($month->gte($cutoff)) {
                continue;
            }

            DB::statement(sprintf('ALTER TABLE `%s` DROP PARTITION %s', $table, $name));
            $dropped++;
        }

        return $dropped;
    }

    public static function recomposePrimaryKey(string $table): void
    {
        if (! self::enabled()) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` DROP PRIMARY KEY, ADD PRIMARY KEY (`id`, `created_at`)',
            $table,
        ));
    }
}
