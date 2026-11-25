<?php

use App\Domains\Companies\Models\Company;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

dataset('workbook pages', [
    'PO matching' => ['po-matching', 'po-matching/index'],
    'RA matching' => ['ra-matching', 'ra-matching/index'],
]);

it('redirects guests to the login page', function (string $route) {
    $this->get(route($route))->assertRedirect(route('login'));
})->with('workbook pages');

it('renders the page for a company with the workbook tools', function (string $route, string $component) {
    $user = User::factory()->for(Company::factory()->withWorkbookTools())->create();

    $this->actingAs($user)
        ->get(route($route))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component($component)
            ->where('auth.company.workbookTools', true));
})->with('workbook pages');

it('refuses companies without them', function (string $route) {
    $user = User::factory()->for(Company::factory())->create();

    $this->actingAs($user)->get(route($route))->assertForbidden();
})->with('workbook pages');

it('tells the sidebar whether to show them', function () {
    $this->actingAs(User::factory()->for(Company::factory())->create())
        ->get(route('sales.report'))
        ->assertInertia(fn (Assert $page) => $page->where('auth.company.workbookTools', false));
});
