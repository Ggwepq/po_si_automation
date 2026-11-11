<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Item lines of a DSR. Date and site are copied from the report so
        // period reports aggregate this table alone, without joins.
        Schema::create('dsr_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dsr_report_id')->constrained()->cascadeOnDelete();
            $table->foreignId('site_id')->constrained()->restrictOnDelete();
            $table->foreignId('article_id')->constrained()->restrictOnDelete();
            $table->date('transaction_date');
            $table->decimal('sales_qty', 12, 3);
            $table->decimal('vat_exempt_sales', 14, 2);
            $table->decimal('vatable_sales', 14, 2);
            $table->decimal('total_sales', 14, 2);

            $table->index(['transaction_date', 'article_id']);
            $table->index(['transaction_date', 'site_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dsr_lines');
    }
};
