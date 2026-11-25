<?php

use App\Domains\Companies\Models\Company;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function hnf(): Company
{
    return Company::factory()->create(['name' => 'HnF', 'account_number' => '80369']);
}

it('logs an accountant in with the account number', function () {
    $user = User::factory()->for(hnf())->create();

    $this->post(route('login.store'), ['email' => '80369', 'password' => 'password'])
        ->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticatedAs($user);
});

it('still logs an accountant in with their email', function () {
    $user = User::factory()->for(hnf())->create(['email' => 'juan@example.com']);

    $this->post(route('login.store'), ['email' => 'juan@example.com', 'password' => 'password']);

    $this->assertAuthenticatedAs($user);
});

it('rejects a wrong password or an unknown account number', function () {
    User::factory()->for(hnf())->create();

    $this->post(route('login.store'), ['email' => '80369', 'password' => 'wrong'])->assertSessionHasErrors('email');
    $this->post(route('login.store'), ['email' => '99999', 'password' => 'password'])->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('asks for the email when several people share the account number', function () {
    $company = hnf();
    User::factory()->count(2)->for($company)->create();

    $this->post(route('login.store'), ['email' => '80369', 'password' => 'password'])
        ->assertSessionHasErrors(['email' => 'Several people use this account number. Log in with your email instead.']);

    $this->assertGuest();
});

it('keeps super admins off the accountant login', function () {
    User::factory()->superAdmin()->create(['email' => 'admin@example.com']);

    $this->post(route('login.store'), ['email' => 'admin@example.com', 'password' => 'password'])->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('logs super admins in on the admin login page only', function () {
    $admin = User::factory()->superAdmin()->create(['email' => 'admin@example.com']);
    User::factory()->for(hnf())->create(['email' => 'juan@example.com']);

    $this->get(route('admin.login'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/login')->where('portal', 'admin'));

    $this->from(route('admin.login'))
        ->post(route('login.store'), ['email' => 'juan@example.com', 'password' => 'password', 'portal' => 'admin'])
        ->assertRedirect(route('admin.login'))
        ->assertSessionHasErrors('email');
    $this->assertGuest();

    $this->post(route('login.store'), ['email' => 'admin@example.com', 'password' => 'password', 'portal' => 'admin']);
    $this->assertAuthenticatedAs($admin);
});
