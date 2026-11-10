<?php

use App\Models\User;

it('creates a verified account', function () {
    $this->artisan('user:create', ['--name' => 'Jane Doe', '--email' => 'jane@example.com'])
        ->expectsQuestion('Password', 'a-Secure-pass-123')
        ->expectsQuestion('Confirm password', 'a-Secure-pass-123')
        ->assertSuccessful();

    $user = User::where('email', 'jane@example.com')->firstOrFail();

    expect($user->name)->toBe('Jane Doe')
        ->and($user->hasVerifiedEmail())->toBeTrue();
});

it('rejects a duplicate email', function () {
    User::factory()->create(['email' => 'jane@example.com']);

    $this->artisan('user:create', ['--name' => 'Jane Doe', '--email' => 'jane@example.com'])
        ->expectsQuestion('Password', 'a-Secure-pass-123')
        ->expectsQuestion('Confirm password', 'a-Secure-pass-123')
        ->assertFailed();

    expect(User::where('email', 'jane@example.com')->count())->toBe(1);
});

it('rejects mismatched passwords', function () {
    $this->artisan('user:create', ['--name' => 'Jane Doe', '--email' => 'jane@example.com'])
        ->expectsQuestion('Password', 'a-Secure-pass-123')
        ->expectsQuestion('Confirm password', 'something-else-456')
        ->assertFailed();

    expect(User::count())->toBe(0);
});
