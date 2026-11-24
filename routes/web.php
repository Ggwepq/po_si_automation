<?php

use App\Http\Controllers\Sales\DsrImportController;
use App\Http\Controllers\Sales\SalesReportController;
use Illuminate\Support\Facades\Route;

// Internal tool: there is no public landing page. Guests are sent to log in.
Route::redirect('/', '/dashboard')->name('home');

// Company pages: every query is scoped to the signed-in user's company.
Route::middleware(['auth', 'verified', 'company'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Workbook tools run entirely in the browser; the server only serves the page.
    Route::inertia('po-matching', 'po-matching/index')->name('po-matching');
    Route::inertia('ra-matching', 'ra-matching/index')->name('ra-matching');

    Route::get('sales/report', [SalesReportController::class, 'show'])->name('sales.report');
    Route::get('sales/import', [DsrImportController::class, 'create'])->name('sales.import');
    Route::post('sales/import', [DsrImportController::class, 'store'])
        ->middleware('throttle:60,1')
        ->name('sales.import.store');
    Route::post('sales/import/summary', [DsrImportController::class, 'storeSummary'])
        ->middleware('throttle:60,1')
        ->name('sales.import.summary');
});

require __DIR__.'/admin.php';
require __DIR__.'/settings.php';
