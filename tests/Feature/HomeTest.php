<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HomeTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_redirects_to_the_dashboard()
    {
        $response = $this->get(route('home'));

        $response->assertRedirect('/dashboard');
    }

    public function test_public_registration_is_disabled()
    {
        $this->get('/register')->assertNotFound();
    }
}
