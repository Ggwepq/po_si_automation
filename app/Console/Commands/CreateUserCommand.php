<?php

namespace App\Console\Commands;

use App\Actions\Fortify\CreateNewUser;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

/**
 * Accounts are invite-only: public registration is disabled, so new users
 * are created by an administrator from the command line.
 */
class CreateUserCommand extends Command
{
    protected $signature = 'user:create
        {--name= : Full name}
        {--email= : Email address used to log in}';

    protected $description = 'Create a login account (public registration is disabled)';

    public function handle(CreateNewUser $createUser): int
    {
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

        // An administrator created the account, so the address is trusted.
        $user->markEmailAsVerified();

        $this->components->info("Created account for {$user->email}.");

        return self::SUCCESS;
    }
}
