<?php

use App\Models\Company;
use App\Models\DiningLayout;
use App\Models\DiningTable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dining_layouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('canvas_width')->default(1100);
            $table->unsignedInteger('canvas_height')->default(720);
            $table->json('objects')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['company_id', 'outlet_id', 'is_active']);
        });

        Schema::table('dining_tables', function (Blueprint $table) {
            $table->foreignId('dining_layout_id')->nullable()->after('outlet_id')->constrained()->nullOnDelete();
            $table->string('shape', 16)->default('rect')->after('area');
            $table->unsignedInteger('x')->default(80)->after('seats');
            $table->unsignedInteger('y')->default(80)->after('x');
            $table->unsignedInteger('width')->default(88)->after('y');
            $table->unsignedInteger('height')->default(88)->after('width');
            $table->unsignedSmallInteger('rotation')->default(0)->after('height');
        });

        $pairs = DB::table('dining_tables')->select('company_id', 'outlet_id')->distinct()->get();

        foreach ($pairs as $pair) {
            $companyId = (int) $pair->company_id;
            $outletId = (int) $pair->outlet_id;
            $company = Company::query()->find($companyId);

            if ($company && $company->name === 'Cafe Demo') {
                DiningLayout::installCafeDemoPlan($companyId, $outletId);

                continue;
            }

            $layout = DiningLayout::withoutGlobalScopes()->create([
                'company_id' => $companyId,
                'outlet_id' => $outletId,
                'name' => 'Denah',
                'canvas_width' => 1100,
                'canvas_height' => 720,
                'objects' => DiningLayout::roomWalls(1100, 720),
                'is_active' => true,
            ]);

            $tables = DiningTable::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('outlet_id', $outletId)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get();

            foreach ($tables as $index => $table) {
                $col = $index % 4;
                $row = intdiv($index, 4);
                $table->forceFill([
                    'dining_layout_id' => $layout->id,
                    'shape' => $table->shape ?: 'rect',
                    'x' => 80 + $col * 140,
                    'y' => 80 + $row * 140,
                    'width' => $table->width ?: 88,
                    'height' => $table->height ?: 88,
                    'rotation' => 0,
                ])->save();
            }
        }
    }

    public function down(): void
    {
        Schema::table('dining_tables', function (Blueprint $table) {
            $table->dropConstrainedForeignId('dining_layout_id');
            $table->dropColumn(['shape', 'x', 'y', 'width', 'height', 'rotation']);
        });

        Schema::dropIfExists('dining_layouts');
    }
};
