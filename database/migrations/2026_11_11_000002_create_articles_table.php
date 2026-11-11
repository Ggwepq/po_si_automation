<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Products, identified by SM's article code.
        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('description');
            $table->string('barcode', 30)->nullable();
            $table->string('uom', 10)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};
