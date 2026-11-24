<?php

use App\Domains\Companies\Models\Company;
use App\Models\User;

it('creates a verified account in a company', function () {
    $company = Company::factory()->create(['slug' => 'hnf']);

    $this->artisan('user:create', ['--name' => 'Jane Doe', '--email' => 'jane@example.com', '--company' => 'hnf'])
        ->expectsQuestion('Password', 'a-Secure-pass-123')
        ->expectsQuestion('Confirm password', 'a-Secure-pass-123')
        ->assertSuccessful();

    $user = User::where('email', 'jane@example.com')->firstOrFail();

    expect($user->name)->toBe('Jane Doe')
        ->and($user->company_id)->toBe($company->id)
        ->and($user->isSuperAdmin())->toBeFalse()
        ->and($user->hasVerifiedEmail())->toBeTrue();
});

it('creates a super admin without a company', function () {
    $this->artisan('user:create', ['--name' => 'Admin', '--email' => 'admin@example.com', '--super-admin' => true])
        ->expectsQuestion('Password', 'a-Secure-pass-123')
        ->expectsQuestion('Confirm password', 'a-Secure-pass-123')
        ->assertSuccessful();

    $user = User::where('email', 'admin@example.com')->firstOrFail();

    expect($user->isSuperAdmin())->toBeTrue()
        ->and($user->company_id)->toBeNull();
});

it('rejects an unknown company', function () {
    $this->artisan('user:create', ['--name' => 'Jane Doe', '--email' => 'jane@example.com', '--company' => 'nope'])
        ->assertFailed();

    expect(User::count())->toBe(0);
});

it('rejects a duplicate email', function () {
    $company = Company::factory()->create();
    User::factory()->create(['email' => 'jane@example.com']);

    $this->artisan('user:create', ['--name' => 'Jane Doe', '--email' => 'jane@example.com', '--company' => $company->slug])
        ->expectsQuestion('Password', 'a-Secure-pass-123')
        ->expectsQuestion('Confirm password', 'a-Secure-pass-123')
        ->assertFailed();

    expect(User::where('email', 'jane@example.com')->count())->toBe(1);
});

it('rejects mismatched passwords', function () {
    $company = Company::factory()->create();

    $this->artisan('user:create', ['--name' => 'Jane Doe', '--email' => 'jane@example.com', '--company' => $company->slug])
        ->expectsQuestion('Password', 'a-Secure-pass-123')
        ->expectsQuestion('Confirm password', 'something-else-456')
        ->assertFailed();

    expect(User::count())->toBe(0);
});
