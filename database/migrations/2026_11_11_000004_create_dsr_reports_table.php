<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One DSR document: a single store's sales for a single day.
        Schema::create('dsr_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->constrained()->restrictOnDelete();
            $table->date('transaction_date');
            $table->string('data_status', 30)->nullable();
            $table->unsignedInteger('article_count');
            $table->decimal('total_qty', 14, 3);
            $table->decimal('total_sales', 14, 2);
            $table->foreignId('dsr_import_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            // Re-importing a store-day replaces it instead of duplicating it.
            $table->unique(['site_id', 'transaction_date']);
            $table->index('transaction_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dsr_reports');
    }
};
