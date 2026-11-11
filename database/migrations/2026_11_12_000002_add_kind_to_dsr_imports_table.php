<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Import history now covers both DSR files ("detail") and DSR
        // Summaries ("summary"); existing rows are DSR files.
        Schema::table('dsr_imports', function (Blueprint $table) {
            $table->string('kind', 20)->default('detail')->after('file_name');
        });
    }

    public function down(): void
    {
        Schema::table('dsr_imports', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
