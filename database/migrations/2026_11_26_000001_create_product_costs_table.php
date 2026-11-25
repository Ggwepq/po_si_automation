<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // What one unit of an item costs the company, from a date onwards.
        // A new price adds a row, so past sales keep the cost of their time.
        Schema::create('product_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('article_id')->constrained()->restrictOnDelete();
            $table->decimal('unit_cost', 12, 4);
            // Plain Y-m-d, compared with dsr_lines.transaction_date.
            $table->date('effective_from');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'article_id', 'effective_from']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_costs');
    }
};
