<?php

use App\Models\Outlet;
use App\Models\Warehouse;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('stock_balances', 'warehouse_id')) {
            Schema::table('stock_balances', function (Blueprint $table) {
                $table->foreignId('warehouse_id')->nullable()->after('outlet_id')->constrained()->restrictOnDelete();
            });
        }

        if (! Schema::hasColumn('stock_movements', 'warehouse_id')) {
            Schema::table('stock_movements', function (Blueprint $table) {
                $table->foreignId('warehouse_id')->nullable()->after('outlet_id')->constrained()->restrictOnDelete();
            });
        }

        $pairs = DB::table('stock_balances')
            ->select('company_id', 'outlet_id')
            ->distinct()
            ->get();

        $salePairs = DB::table('sales')
            ->select('company_id', 'outlet_id')
            ->distinct()
            ->get();

        $movementPairs = DB::table('stock_movements')
            ->select('company_id', 'outlet_id')
            ->distinct()
            ->get();

        $allPairs = collect()
            ->merge($pairs)
            ->merge($salePairs)
            ->merge($movementPairs)
            ->unique(fn ($row) => $row->company_id.'-'.$row->outlet_id);

        $map = [];

        foreach ($allPairs as $row) {
            $map[$row->company_id.'-'.$row->outlet_id] = $this->ensureDefaultWarehouse((int) $row->company_id, (int) $row->outlet_id);
        }

        Outlet::query()->withoutGlobalScopes()->each(function (Outlet $outlet) use (&$map) {
            $key = $outlet->company_id.'-'.$outlet->id;
            if (! isset($map[$key])) {
                $map[$key] = $this->ensureDefaultWarehouse((int) $outlet->company_id, (int) $outlet->id);
            }
        });

        foreach ($map as $key => $warehouseId) {
            [$companyId, $outletId] = array_map('intval', explode('-', $key));
            DB::table('stock_balances')
                ->where('company_id', $companyId)
                ->where('outlet_id', $outletId)
                ->whereNull('warehouse_id')
                ->update(['warehouse_id' => $warehouseId]);

            DB::table('stock_movements')
                ->where('company_id', $companyId)
                ->where('outlet_id', $outletId)
                ->whereNull('warehouse_id')
                ->update(['warehouse_id' => $warehouseId]);
        }

        $dupes = DB::table('stock_balances')
            ->select('warehouse_id', 'product_id', DB::raw('MIN(id) as keep_id'), DB::raw('SUM(qty) as total_qty'))
            ->whereNotNull('warehouse_id')
            ->groupBy('warehouse_id', 'product_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($dupes as $dupe) {
            DB::table('stock_balances')
                ->where('warehouse_id', $dupe->warehouse_id)
                ->where('product_id', $dupe->product_id)
                ->where('id', '!=', $dupe->keep_id)
                ->delete();
            DB::table('stock_balances')
                ->where('id', $dupe->keep_id)
                ->update(['qty' => (int) $dupe->total_qty]);
        }

        // MySQL: unique (outlet_id, product_id) may back the outlet FK — drop FK first.
        $this->dropForeignIfExists('stock_balances', 'stock_balances_outlet_id_foreign');
        $this->dropIndexIfExists('stock_balances', 'stock_balances_outlet_id_product_id_unique');

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            $nullBalances = DB::table('stock_balances')->whereNull('warehouse_id')->count();
            $nullMovements = DB::table('stock_movements')->whereNull('warehouse_id')->count();
            if ($nullBalances === 0 && $nullMovements === 0) {
                DB::statement('ALTER TABLE stock_balances MODIFY warehouse_id BIGINT UNSIGNED NOT NULL');
                DB::statement('ALTER TABLE stock_movements MODIFY warehouse_id BIGINT UNSIGNED NOT NULL');
            }
        }

        if (! $this->indexExists('stock_balances', 'stock_balances_warehouse_id_product_id_unique')) {
            Schema::table('stock_balances', function (Blueprint $table) {
                $table->unique(['warehouse_id', 'product_id']);
            });
        }

        if (! $this->foreignExists('stock_balances', 'stock_balances_outlet_id_foreign')) {
            Schema::table('stock_balances', function (Blueprint $table) {
                $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
            });
        }

        if (! $this->indexExists('stock_movements', 'stock_movements_warehouse_id_product_id_created_at_index')) {
            Schema::table('stock_movements', function (Blueprint $table) {
                $table->index(['warehouse_id', 'product_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        $this->dropIndexIfExists('stock_balances', 'stock_balances_warehouse_id_product_id_unique');
        $this->dropIndexIfExists('stock_movements', 'stock_movements_warehouse_id_product_id_created_at_index');

        Schema::table('stock_balances', function (Blueprint $table) {
            $table->dropConstrainedForeignId('warehouse_id');
            $table->unique(['outlet_id', 'product_id']);
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('warehouse_id');
        });
    }

    private function ensureDefaultWarehouse(int $companyId, int $outletId): int
    {
        $existing = Warehouse::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('outlet_id', $outletId)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->first();

        if ($existing) {
            if (! $existing->is_default) {
                Warehouse::query()
                    ->withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('outlet_id', $outletId)
                    ->whereKeyNot($existing->id)
                    ->update(['is_default' => false]);
                $existing->forceFill(['is_default' => true, 'is_active' => true])->save();
            }

            return (int) $existing->id;
        }

        $outlet = Outlet::query()->withoutGlobalScopes()->find($outletId);
        $name = $outlet?->name ? 'Gudang '.$outlet->name : 'Gudang Utama';

        return (int) Warehouse::query()->withoutGlobalScopes()->create([
            'company_id' => $companyId,
            'outlet_id' => $outletId,
            'name' => $name,
            'is_default' => true,
            'is_active' => true,
        ])->id;
    }

    private function foreignExists(string $table, string $name): bool
    {
        $db = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $name)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->exists();
    }

    private function dropForeignIfExists(string $table, string $name): void
    {
        if ($this->foreignExists($table, $name)) {
            Schema::table($table, function (Blueprint $blueprint) use ($name) {
                $blueprint->dropForeign($name);
            });
        }
    }

    private function dropIndexIfExists(string $table, string $name): void
    {
        if ($this->indexExists($table, $name)) {
            Schema::table($table, function (Blueprint $blueprint) use ($name) {
                $blueprint->dropUnique($name);
            });
        }
    }

    private function indexExists(string $table, string $name): bool
    {
        $db = Schema::getConnection()->getDatabaseName();

        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', $db)
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $name)
            ->exists();
    }
};
