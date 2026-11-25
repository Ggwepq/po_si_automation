<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_the_dashboard_opens_the_sales_report()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        // The sales report is the home page.
        $this->get(route('dashboard'))->assertRedirect(route('sales.report'));
    }
}
