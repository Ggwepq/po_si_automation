<?php

use App\Domains\Companies\Models\Company;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Hash;

it('creates the starting companies and sample accounts', function () {
    $this->seed(DatabaseSeeder::class);

    $admin = User::where('email', 'admin@test.com')->sole();
    $juan = User::where('email', 'juan@gmail.com')->sole();

    expect(Company::orderBy('account_number')->pluck('account_number', 'slug')->all())
        ->toBe(['oroza-enterprise' => '150551', 'foodsecrets' => '60291', 'hnf' => '80369'])
        ->and($admin->isSuperAdmin())->toBeTrue()
        ->and($admin->company_id)->toBeNull()
        ->and($juan->isSuperAdmin())->toBeFalse()
        ->and($juan->company?->slug)->toBe('hnf')
        ->and(Hash::check('password', $juan->password))->toBeTrue()
        // PO & SI workflow and RA item matching are Oroza Enterprise's only.
        ->and(Company::where('workbook_tools', true)->pluck('slug')->all())->toBe(['oroza-enterprise']);
});

it('gives companies that already exist their account numbers', function () {
    Company::factory()->create(['slug' => 'oroza-enterprise', 'name' => 'Oroza Enterprise', 'account_number' => null]);

    $this->seed(DatabaseSeeder::class);

    expect(Company::where('slug', 'oroza-enterprise')->sole()->account_number)->toBe('150551');
});

it('can run again without duplicating or overwriting anything', function () {
    $this->seed(DatabaseSeeder::class);
    User::where('email', 'juan@gmail.com')->sole()->update(['password' => 'a-New-pass-123']);

    $this->seed(DatabaseSeeder::class);

    expect(Company::count())->toBe(3)
        ->and(User::count())->toBe(2)
        ->and(Hash::check('a-New-pass-123', User::where('email', 'juan@gmail.com')->sole()->password))->toBeTrue();
});
