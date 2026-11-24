<?php

namespace App\Domains\Companies\Actions;

use App\Domains\Companies\Models\Company;
use App\Models\User;

/**
 * Creates a login account for a company's staff. Accounts are invite-only,
 * and the admin entered the address, so it counts as verified.
 */
class CreateCompanyUser
{
    public function handle(Company $company, string $name, string $email, string $password): User
    {
        $user = new User(['name' => trim($name), 'email' => $email, 'password' => $password]);
        $user->company()->associate($company);
        $user->forceFill(['email_verified_at' => now()]);
        $user->save();

        return $user;
    }
}
