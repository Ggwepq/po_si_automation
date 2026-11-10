<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

dataset('workbook pages', [
    'PO matching' => ['po-matching', 'po-matching/index'],
    'RA matching' => ['ra-matching', 'ra-matching/index'],
]);

it('redirects guests to the login page', function (string $route) {
    $this->get(route($route))->assertRedirect(route('login'));
})->with('workbook pages');

it('renders the page for signed-in users', function (string $route, string $component) {
    $this->actingAs(User::factory()->create())
        ->get(route($route))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with('workbook pages');
