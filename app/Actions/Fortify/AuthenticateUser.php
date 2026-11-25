<?php

namespace App\Actions\Fortify;

use App\Domains\Companies\Models\Company;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Fortify;

/**
 * Finds the user for a login attempt. There are two login pages:
 *
 * - /login for company accountants, who type their company's account number
 *   (SM Vendor Portal number) or their email;
 * - /admin/login for super admins, by email only.
 *
 * Each page only lets its own kind of user in. Returns null for wrong
 * credentials so Fortify shows its usual message and throttles retries.
 */
class AuthenticateUser
{
    /** Sent as the hidden "portal" field by the admin login page. */
    public const ADMIN_PORTAL = 'admin';

    public function __invoke(Request $request): ?User
    {
        $login = trim($request->string(Fortify::username())->toString());
        $user = $request->input('portal') === self::ADMIN_PORTAL
            ? User::where('email', $login)->where('is_super_admin', true)->first()
            : $this->companyUser($login);

        return $user !== null && Hash::check($request->string('password')->toString(), $user->password)
            ? $user
            : null;
    }

    private function companyUser(string $login): ?User
    {
        if (str_contains($login, '@')) {
            return User::where('email', $login)
                ->where('is_super_admin', false)
                ->whereNotNull('company_id')
                ->first();
        }

        $company = Company::where('account_number', $login)->first();

        if ($company === null) {
            return null;
        }

        $users = $company->users()->where('is_super_admin', false)->limit(2)->get();

        // An account number names a company, not a person.
        if ($users->count() > 1) {
            throw ValidationException::withMessages([
                Fortify::username() => 'Several people use this account number. Log in with your email instead.',
            ]);
        }

        return $users->first();
    }
}
