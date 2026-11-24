<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Tables holding a company's imported sales. Vendors, stores and items stay shared: they are SM's own codes. */
    private const TABLES = ['dsr_imports', 'dsr_reports', 'dsr_lines', 'dsr_summaries'];

    public function up(): void
    {
        $ownerId = $this->existingDataOwner();

        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->unsignedBigInteger('company_id')->nullable()->after('id');
            });

            if ($ownerId !== null) {
                DB::table($name)->update(['company_id' => $ownerId]);
            }

            Schema::table($name, function (Blueprint $table) {
                $table->unsignedBigInteger('company_id')->nullable(false)->change();
                $table->foreign('company_id')->references('id')->on('companies')->restrictOnDelete();
            });
        }

        Schema::table('dsr_imports', function (Blueprint $table) {
            $table->index(['company_id', 'created_at']);
        });

        // A store-day is unique per company, so two companies importing the
        // same vendor never replace each other's sales. The vendor_id index
        // keeps its foreign key indexed once the old unique index is gone.
        foreach (['dsr_reports', 'dsr_summaries'] as $name) {
            Schema::table($name, function (Blueprint $table) use ($name) {
                $table->index('vendor_id');
                // Named explicitly: the generated name exceeds MySQL's 64 characters.
                $table->unique(['company_id', 'vendor_id', 'site_id', 'transaction_date'], "{$name}_company_store_day_unique");
            });
            Schema::table($name, function (Blueprint $table) {
                $table->dropUnique(['vendor_id', 'site_id', 'transaction_date']);
            });
        }

        Schema::table('dsr_reports', function (Blueprint $table) {
            $table->index(['company_id', 'transaction_date']);
            $table->dropIndex(['transaction_date']);
        });

        Schema::table('dsr_summaries', function (Blueprint $table) {
            $table->index(['company_id', 'transaction_date', 'site_id']);
            $table->dropIndex(['transaction_date', 'site_id']);
        });

        // Every report query filters by company first, then by date.
        Schema::table('dsr_lines', function (Blueprint $table) {
            $table->index(['company_id', 'transaction_date', 'article_id']);
            $table->index(['company_id', 'transaction_date', 'site_id']);
            $table->index(['company_id', 'transaction_date', 'vendor_id']);
            $table->dropIndex(['transaction_date', 'article_id']);
            $table->dropIndex(['transaction_date', 'site_id']);
            $table->dropIndex(['transaction_date', 'vendor_id']);
        });
    }

    public function down(): void
    {
        // Foreign keys first: MySQL may be using the composite indexes for them.
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropForeign(['company_id']);
            });
        }

        Schema::table('dsr_lines', function (Blueprint $table) {
            $table->index(['transaction_date', 'article_id']);
            $table->index(['transaction_date', 'site_id']);
            $table->index(['transaction_date', 'vendor_id']);
            $table->dropIndex(['company_id', 'transaction_date', 'article_id']);
            $table->dropIndex(['company_id', 'transaction_date', 'site_id']);
            $table->dropIndex(['company_id', 'transaction_date', 'vendor_id']);
        });

        Schema::table('dsr_summaries', function (Blueprint $table) {
            $table->index(['transaction_date', 'site_id']);
            $table->dropIndex(['company_id', 'transaction_date', 'site_id']);
        });

        Schema::table('dsr_reports', function (Blueprint $table) {
            $table->index('transaction_date');
            $table->dropIndex(['company_id', 'transaction_date']);
        });

        // Fails if two companies imported the same store-day; that data cannot be merged.
        foreach (['dsr_reports', 'dsr_summaries'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->unique(['vendor_id', 'site_id', 'transaction_date']);
            });
            Schema::table($name, function (Blueprint $table) use ($name) {
                $table->dropUnique("{$name}_company_store_day_unique");
                $table->dropIndex(['vendor_id']);
            });
        }

        Schema::table('dsr_imports', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'created_at']);
        });

        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropColumn('company_id');
            });
        }
    }

    /** Sales imported before companies existed belong to Oroza Enterprise. */
    private function existingDataOwner(): ?int
    {
        $hasData = collect(self::TABLES)->contains(fn (string $name) => DB::table($name)->exists());

        if (! $hasData) {
            return null;
        }

        $id = DB::table('companies')->where('slug', 'oroza-enterprise')->value('id');

        return is_numeric($id) ? (int) $id : DB::table('companies')->insertGetId([
            'name' => 'Oroza Enterprise',
            'slug' => 'oroza-enterprise',
            'logo_path' => 'assets/logo/oroza-ent/p1-6.png',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
