<?php

namespace App\Http\Controllers;

use App\Domains\Sales\Actions\GetSalesDashboard;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function show(GetSalesDashboard $dashboard): Response
    {
        return Inertia::render('dashboard', ['overview' => $dashboard->handle()]);
    }
}
