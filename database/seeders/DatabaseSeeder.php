<?php

namespace Database\Seeders;

use App\Domains\Companies\Models\Company;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Starting companies and sample accounts. Safe to run more than once and in
 * production (no factories, so no dev-only packages): existing companies
 * and accounts are left as they are.
 */
class DatabaseSeeder extends Seeder
{
    private const SAMPLE_PASSWORD = 'password';

    public function run(): void
    {
        Company::firstOrCreate(['slug' => 'oroza-enterprise'], [
            'name' => 'Oroza Enterprise',
            'logo_path' => 'assets/logo/oroza-ent/p1-6.png',
        ]);

        $hnf = Company::firstOrCreate(['slug' => 'hnf'], [
            'name' => 'HnF',
            'logo_path' => 'assets/logo/hnf/p1-3.png',
        ]);

        $this->account('admin@test.com', 'Super Admin', null);
        $this->account('juan@gmail.com', 'Juan', $hnf);
    }

    /** A null company makes a super admin. */
    private function account(string $email, string $name, ?Company $company): void
    {
        if (User::where('email', $email)->exists()) {
            return;
        }

        $user = new User(['name' => $name, 'email' => $email, 'password' => self::SAMPLE_PASSWORD]);
        $user->company()->associate($company);
        $user->is_super_admin = $company === null;
        $user->forceFill(['email_verified_at' => now()]);
        $user->save();
    }
}
