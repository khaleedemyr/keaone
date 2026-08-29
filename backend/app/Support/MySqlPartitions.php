<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MySqlPartitions
{
    public static function enabled(): bool
    {
        return in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    public static function isPartitioned(string $table): bool
    {
        if (! self::enabled()) {
            return false;
        }

        $db = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.PARTITIONS')
            ->where('TABLE_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->whereNotNull('PARTITION_NAME')
            ->exists();
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
                "PARTITION %s VALUES LESS THAN ('%s')",
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

    /**
     * Drop FKs on other tables that reference this table (required before ALTER PARTITION).
     */
    public static function dropIncomingForeignKeys(string $referencedTable): void
    {
        if (! self::enabled()) {
            return;
        }

        $db = Schema::getConnection()->getDatabaseName();
        $rows = DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('REFERENCED_TABLE_SCHEMA', $db)
            ->where('REFERENCED_TABLE_NAME', $referencedTable)
            ->whereNotNull('REFERENCED_COLUMN_NAME')
            ->select('TABLE_NAME', 'CONSTRAINT_NAME')
            ->distinct()
            ->get();

        foreach ($rows as $row) {
            DB::statement(sprintf(
                'ALTER TABLE `%s` DROP FOREIGN KEY `%s`',
                $row->TABLE_NAME,
                $row->CONSTRAINT_NAME,
            ));
        }
    }

    public static function dropAllForeignKeyConstraints(string $table): void
    {
        self::dropIncomingForeignKeys($table);
        self::dropForeignKeys($table);
    }

    public static function createIndexIfNotExists(string $table, string $index, string $columns, bool $unique = false): void
    {
        if (! self::enabled() || self::indexExists($table, $index)) {
            return;
        }

        $type = $unique ? 'UNIQUE INDEX' : 'INDEX';
        DB::statement(sprintf('CREATE %s `%s` ON `%s` (%s)', $type, $index, $table, $columns));
    }

    public static function indexExists(string $table, string $index): bool
    {
        if (! self::enabled()) {
            return false;
        }

        $db = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $index)
            ->exists();
    }

    public static function dropIndexIfExists(string $table, string $index): void
    {
        if (! self::enabled() || ! self::indexExists($table, $index)) {
            return;
        }

        DB::statement(sprintf('ALTER TABLE `%s` DROP INDEX `%s`', $table, $index));
    }

    public static function applyRangeByCreatedAt(string $table): void
    {
        if (! self::enabled() || self::isPartitioned($table)) {
            return;
        }

        self::ensureDatetimeCreatedAt($table);

        [$from, $to] = self::window();
        $definitions = self::monthlyDefinitions($from, $to);

        DB::statement(sprintf(
            'ALTER TABLE `%s` PARTITION BY RANGE COLUMNS (`created_at`) (%s)',
            $table,
            $definitions,
        ));
    }

    /**
     * RANGE COLUMNS does not accept TIMESTAMP on many hosted MySQL builds (error 1659).
     */
    public static function ensureDatetimeCreatedAt(string $table): void
    {
        if (! self::enabled() || ! Schema::hasColumn($table, 'created_at')) {
            return;
        }

        $meta = self::columnMeta($table, 'created_at');
        if (! $meta || strtolower((string) $meta->DATA_TYPE) !== 'timestamp') {
            return;
        }

        $nullable = ($meta->IS_NULLABLE ?? 'NO') === 'YES';

        if ($nullable) {
            DB::statement(sprintf('ALTER TABLE `%s` MODIFY `created_at` DATETIME NULL', $table));
        } else {
            DB::statement(sprintf(
                'ALTER TABLE `%s` MODIFY `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
                $table,
            ));
        }
    }

    private static function columnMeta(string $table, string $column): ?object
    {
        $db = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.COLUMNS')
            ->where('TABLE_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->where('COLUMN_NAME', $column)
            ->first(['DATA_TYPE', 'IS_NULLABLE', 'COLUMN_DEFAULT', 'EXTRA']);
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
                PARTITION %s VALUES LESS THAN (\'%s\'),
                PARTITION pmax VALUES LESS THAN (MAXVALUE)
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
        if (! self::enabled() || self::primaryKeyIncludes($table, 'created_at')) {
            return;
        }

        DB::statement(sprintf(
            'ALTER TABLE `%s` DROP PRIMARY KEY, ADD PRIMARY KEY (`id`, `created_at`)',
            $table,
        ));
    }

    public static function primaryKeyIncludes(string $table, string $column): bool
    {
        if (! self::enabled()) {
            return false;
        }

        $db = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('TABLE_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', 'PRIMARY')
            ->where('COLUMN_NAME', $column)
            ->exists();
    }
}
