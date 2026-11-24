<?php

namespace App\Console\Commands;

use App\Actions\Fortify\CreateNewUser;
use App\Domains\Companies\Models\Company;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

use function Laravel\Prompts\password;
use function Laravel\Prompts\select;
use function Laravel\Prompts\text;

/**
 * Accounts are invite-only: public registration is disabled, so new users
 * are created by a super admin in the app, or from the command line. Every
 * account either belongs to a company or is a super admin.
 */
class CreateUserCommand extends Command
{
    protected $signature = 'user:create
        {--name= : Full name}
        {--email= : Email address used to log in}
        {--company= : Slug of the company the user works for}
        {--super-admin : Manages companies and accounts; belongs to no company}';

    protected $description = 'Create a login account (public registration is disabled)';

    public function handle(CreateNewUser $createUser): int
    {
        $superAdmin = (bool) $this->option('super-admin');
        $company = $superAdmin ? null : $this->company();

        if (! $superAdmin && $company === null) {
            return self::FAILURE;
        }

        $name = $this->option('name') ?: text('Name', required: true);
        $email = $this->option('email') ?: text('Email', required: true);
        $password = password('Password', required: true);
        $confirmation = password('Confirm password', required: true);

        try {
            $user = $createUser->create([
                'name' => (string) $name,
                'email' => (string) $email,
                'password' => $password,
                'password_confirmation' => $confirmation,
            ]);
        } catch (ValidationException $exception) {
            foreach ($exception->validator->errors()->all() as $error) {
                $this->components->error($error);
            }

            return self::FAILURE;
        }

        $user->company()->associate($company);
        $user->is_super_admin = $superAdmin;
        // An administrator created the account, so the address is trusted.
        $user->forceFill(['email_verified_at' => now()]);
        $user->save();

        $this->components->info("Created account for {$user->email}".($company ? " ({$company->name})." : ' (super admin).'));

        return self::SUCCESS;
    }

    private function company(): ?Company
    {
        $slug = $this->option('company');

        if (is_string($slug) && $slug !== '') {
            $company = Company::where('slug', $slug)->first();

            if ($company === null) {
                $this->components->error("No company with the slug \"{$slug}\".");
            }

            return $company;
        }

        $choices = Company::query()->orderBy('name')->pluck('name', 'slug')->all();

        if ($choices === []) {
            $this->components->error('There are no companies yet. Add one in the admin area, or use --super-admin.');

            return null;
        }

        return Company::where('slug', select('Company', $choices))->first();
    }
}
