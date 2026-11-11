<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Audit trail: who imported which DSR file, and what it contained.
        Schema::create('dsr_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('file_name');
            $table->unsignedInteger('report_count');
            $table->unsignedInteger('line_count');
            $table->unsignedInteger('replaced_count');
            $table->date('first_date')->nullable();
            $table->date('last_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dsr_imports');
    }
};
