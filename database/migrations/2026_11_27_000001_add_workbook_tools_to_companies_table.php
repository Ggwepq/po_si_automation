<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** The PO & SI workflow and RA item matching are Oroza Enterprise's tools only. */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->boolean('workbook_tools')->default(false)->after('logo_path');
        });

        // Oroza Enterprise (SM vendor 150551) keeps the tools it already had.
        DB::table('companies')->where('account_number', '150551')->update(['workbook_tools' => true]);
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('workbook_tools');
        });
    }
};
