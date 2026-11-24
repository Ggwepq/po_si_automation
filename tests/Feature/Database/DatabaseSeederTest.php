<?php

use App\Domains\Companies\Models\Company;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Hash;

it('creates the starting companies and sample accounts', function () {
    $this->seed(DatabaseSeeder::class);

    $admin = User::where('email', 'admin@test.com')->sole();
    $juan = User::where('email', 'juan@gmail.com')->sole();

    expect(Company::pluck('slug')->sort()->values()->all())->toBe(['hnf', 'oroza-enterprise'])
        ->and($admin->isSuperAdmin())->toBeTrue()
        ->and($admin->company_id)->toBeNull()
        ->and($juan->isSuperAdmin())->toBeFalse()
        ->and($juan->company?->slug)->toBe('hnf')
        ->and(Hash::check('password', $juan->password))->toBeTrue();
});

it('can run again without duplicating or overwriting anything', function () {
    $this->seed(DatabaseSeeder::class);
    User::where('email', 'juan@gmail.com')->sole()->update(['password' => 'a-New-pass-123']);

    $this->seed(DatabaseSeeder::class);

    expect(Company::count())->toBe(2)
        ->and(User::count())->toBe(2)
        ->and(Hash::check('a-New-pass-123', User::where('email', 'juan@gmail.com')->sole()->password))->toBeTrue();
});
