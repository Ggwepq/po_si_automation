<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SM's "DSR Summary": its official total per vendor, store and day.
        // Used only to check the imported DSR lines; never counted as sales.
        Schema::create('dsr_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->restrictOnDelete();
            $table->foreignId('site_id')->constrained()->restrictOnDelete();
            $table->date('transaction_date');
            $table->decimal('total_sales', 14, 2);
            $table->foreignId('dsr_import_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            // Re-importing a summary replaces SM's figure for that store-day.
            $table->unique(['vendor_id', 'site_id', 'transaction_date']);
            $table->index(['transaction_date', 'site_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dsr_summaries');
    }
};
