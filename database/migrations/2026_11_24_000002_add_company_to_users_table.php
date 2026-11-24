<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A user belongs to one company, except super admins, who manage
        // companies and accounts and belong to none.
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('id')->constrained()->restrictOnDelete();
            $table->boolean('is_super_admin')->default(false)->after('company_id');
        });

        // Everyone who used the app before companies existed works for
        // Oroza Enterprise, which owns all existing data.
        if (DB::table('users')->exists()) {
            DB::table('users')->update(['company_id' => $this->orozaEnterpriseId()]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_id');
            $table->dropColumn('is_super_admin');
        });
    }

    private function orozaEnterpriseId(): int
    {
        $id = DB::table('companies')->where('slug', 'oroza-enterprise')->value('id');

        return is_numeric($id) ? (int) $id : DB::table('companies')->insertGetId([
            'name' => 'Oroza Enterprise',
            'slug' => 'oroza-enterprise',
            'logo_path' => 'assets/logo/oroza-ent/p1-6.png',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
