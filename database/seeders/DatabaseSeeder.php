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
        $this->company('oroza-enterprise', 'Oroza Enterprise', '150551', 'assets/logo/oroza-ent/p1-6.png')
            ->update(['workbook_tools' => true]);
        $hnf = $this->company('hnf', 'HnF', '80369', 'assets/logo/hnf/p1-3.png');
        $this->company('foodsecrets', 'Foodsecrets', '60291', null);

        $this->account('admin@test.com', 'Super Admin', null);
        $this->account('juan@gmail.com', 'Juan', $hnf);
    }

    /** Adds the company, or gives an existing one its account number if it has none yet. */
    private function company(string $slug, string $name, string $accountNumber, ?string $logoPath): Company
    {
        $company = Company::firstOrCreate(['slug' => $slug], [
            'name' => $name,
            'account_number' => $accountNumber,
            'logo_path' => $logoPath,
        ]);

        if ($company->account_number === null) {
            $company->update(['account_number' => $accountNumber]);
        }

        return $company;
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
