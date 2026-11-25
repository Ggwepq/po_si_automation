<?php

use App\Domains\Companies\Models\Company;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function superAdmin(): User
{
    return User::factory()->superAdmin()->create();
}

function newUserInput(array $overrides = []): array
{
    return [
        'name' => 'Juan Dela Cruz',
        'email' => 'juan@example.com',
        'password' => 'a-Secure-pass-123',
        'password_confirmation' => 'a-Secure-pass-123',
        ...$overrides,
    ];
}

it('sends guests to the login page', function () {
    $this->get(route('admin.companies.index'))->assertRedirect(route('login'));
});

it('is closed to company users', function () {
    $company = Company::factory()->create();
    $this->actingAs(companyUser());

    $this->get(route('admin.companies.index'))->assertForbidden();
    $this->get(route('admin.companies.show', $company))->assertForbidden();
    $this->post(route('admin.companies.store'), ['name' => 'Sneaky'])->assertForbidden();
    $this->post(route('admin.companies.users.store', $company), newUserInput())->assertForbidden();

    expect(Company::where('name', 'Sneaky')->exists())->toBeFalse()
        ->and(User::where('email', 'juan@example.com')->exists())->toBeFalse();
});

it('lists companies with their user counts', function () {
    $company = Company::factory()->create(['name' => 'HnF']);
    User::factory()->count(2)->for($company)->create();

    $this->actingAs(superAdmin())
        ->get(route('admin.companies.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/companies/index')
            ->where('companies.data.0.name', 'HnF')
            ->where('companies.data.0.userCount', 2)
            ->where('auth.isSuperAdmin', true)
            ->where('auth.company', null));
});

it('adds a company with a logo', function () {
    Storage::fake('public');

    $this->actingAs(superAdmin())
        ->post(route('admin.companies.store'), [
            'name' => 'Herbs & Fruits',
            'logo' => UploadedFile::fake()->image('logo.png', 200, 100),
        ])
        ->assertRedirect(route('admin.companies.show', 'herbs-fruits'));

    $company = Company::sole();

    expect($company->slug)->toBe('herbs-fruits')
        ->and($company->logo_path)->toStartWith('storage/company-logos/herbs-fruits-');

    Storage::disk('public')->assertExists(substr((string) $company->logo_path, strlen('storage/')));
});

it('keeps company names and slugs unique', function () {
    Company::factory()->create(['name' => 'HnF', 'slug' => 'hnf']);
    $this->actingAs(superAdmin());

    $this->post(route('admin.companies.store'), ['name' => 'HnF'])->assertSessionHasErrors('name');
    $this->post(route('admin.companies.store'), ['name' => 'H n F!'])->assertSessionHasNoErrors();

    expect(Company::where('name', 'H n F!')->sole()->slug)->toBe('h-n-f');
});

it('rejects logos that are not images', function () {
    Storage::fake('public');
    $this->actingAs(superAdmin());

    $this->post(route('admin.companies.store'), [
        'name' => 'HnF',
        'logo' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    ])->assertSessionHasErrors('logo');

    expect(Company::count())->toBe(0);
});

it('shows a company and its users', function () {
    $company = Company::factory()->create();
    User::factory()->for($company)->create(['name' => 'Juan']);
    User::factory()->create(['name' => 'Someone else']);

    $this->actingAs(superAdmin())
        ->get(route('admin.companies.show', $company))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/companies/show')
            ->where('company.slug', $company->slug)
            ->has('users.data', 1)
            ->where('users.data.0.name', 'Juan'));
});

it('adds a verified user to a company', function () {
    $company = Company::factory()->create();

    $this->actingAs(superAdmin())
        ->post(route('admin.companies.users.store', $company), newUserInput(['is_super_admin' => true]))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.companies.show', $company));

    $user = User::where('email', 'juan@example.com')->sole();

    expect($user->company_id)->toBe($company->id)
        ->and($user->isSuperAdmin())->toBeFalse()
        ->and($user->hasVerifiedEmail())->toBeTrue();

    auth()->logout();
    $this->post(route('login.store'), ['email' => 'juan@example.com', 'password' => 'a-Secure-pass-123'])
        ->assertRedirect(route('dashboard', absolute: false));
});

it('accepts any password the admin chooses', function () {
    $company = Company::factory()->create();

    $this->actingAs(superAdmin())
        ->post(route('admin.companies.users.store', $company), newUserInput(['password' => 'abc', 'password_confirmation' => 'abc']))
        ->assertSessionHasNoErrors();

    expect($company->users()->sole()->email)->toBe('juan@example.com');
});

it('validates new users', function () {
    $company = Company::factory()->create();
    User::factory()->create(['email' => 'taken@example.com']);
    $this->actingAs(superAdmin());

    $this->post(route('admin.companies.users.store', $company), newUserInput(['email' => 'taken@example.com']))
        ->assertSessionHasErrors('email');
    $this->post(route('admin.companies.users.store', $company), newUserInput(['password_confirmation' => 'different']))
        ->assertSessionHasErrors('password');

    expect($company->users()->count())->toBe(0);
});

it('sends super admins to the admin area instead of company pages', function () {
    $this->actingAs(superAdmin());

    $this->get(route('dashboard'))->assertRedirect(route('admin.companies.index'));
    $this->get(route('sales.report'))->assertRedirect(route('admin.companies.index'));
    $this->post(route('sales.import.store'), ['file_name' => 'x.xlsx', 'reports' => []])->assertForbidden();
});
