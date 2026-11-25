<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The company's SM Vendor Portal number (e.g. 150551). Accountants log
        // in with it, and DSR imports must carry it as the vendor code.
        Schema::table('companies', function (Blueprint $table) {
            $table->string('account_number', 20)->nullable()->unique()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropUnique(['account_number']);
            $table->dropColumn('account_number');
        });
    }
};
