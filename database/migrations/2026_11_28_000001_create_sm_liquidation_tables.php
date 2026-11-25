<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * SM's half-month settlement reports and the payments received for them:
     * - csr_lines: "Consolidated Sales Report", SM's figure per store and item for a period.
     * - liquidations (+ stores): "Consolidated Liquidation Report", what one SM
     *   chain head office owes for a period, after 1% withholding tax.
     * - liquidation_payments: what was actually received, entered by the accountant.
     */
    public function up(): void
    {
        Schema::create('csr_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('vendor_id')->constrained()->restrictOnDelete();
            $table->foreignId('site_id')->constrained()->restrictOnDelete();
            $table->foreignId('article_id')->constrained()->restrictOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('sales_qty', 14, 3);
            $table->decimal('vat_exempt_sales', 14, 2);
            $table->decimal('vatable_sales', 14, 2);
            $table->decimal('total_sales', 14, 2);
            $table->foreignId('dsr_import_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'site_id', 'period_start', 'period_end', 'vendor_id', 'article_id'], 'csr_lines_period_item_unique');
            $table->index(['company_id', 'period_start']);
        });

        Schema::create('liquidations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('vendor_id')->constrained()->restrictOnDelete();
            $table->string('center_code', 20);
            $table->string('center_name');
            $table->string('chain', 50);
            $table->string('payment_term', 20)->nullable();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('amount_payable', 14, 2);
            $table->decimal('ewt', 14, 2);
            $table->decimal('net_due', 14, 2);
            $table->foreignId('dsr_import_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'vendor_id', 'center_code', 'period_start', 'period_end'], 'liquidations_center_period_unique');
            $table->index(['company_id', 'period_end']);
        });

        Schema::create('liquidation_stores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('liquidation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('site_id')->constrained()->restrictOnDelete();
            $table->decimal('vat_exempt_sales', 14, 2);
            $table->decimal('vatable_sales', 14, 2);
            $table->decimal('vat_amount', 14, 2);
            $table->decimal('total_sales', 14, 2);

            $table->unique(['liquidation_id', 'site_id']);
        });

        Schema::create('liquidation_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('liquidation_id')->constrained()->cascadeOnDelete();
            $table->date('paid_on');
            $table->string('reference', 100)->nullable();
            $table->decimal('amount', 14, 2);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidation_payments');
        Schema::dropIfExists('liquidation_stores');
        Schema::dropIfExists('liquidations');
        Schema::dropIfExists('csr_lines');
    }
};
