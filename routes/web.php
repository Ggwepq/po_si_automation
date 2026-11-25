<?php

use App\Http\Controllers\Sales\DsrImportController;
use App\Http\Controllers\Sales\LiquidationController;
use App\Http\Controllers\Sales\ProductCostController;
use App\Http\Controllers\Sales\SalesReportController;
use Illuminate\Support\Facades\Route;

// Internal tool: there is no public landing page. Guests are sent to log in.
Route::redirect('/', '/dashboard')->name('home');

// Company pages: every query is scoped to the signed-in user's company.
Route::middleware(['auth', 'verified', 'company'])->group(function () {
    // The sales report is the home page; /dashboard (where login lands) opens it.
    Route::redirect('dashboard', 'sales/report')->name('dashboard');

    // Workbook tools run entirely in the browser; the server only serves the page.
    // Only for companies that have them (Oroza Enterprise).
    Route::middleware('workbook-tools')->group(function () {
        Route::inertia('po-matching', 'po-matching/index')->name('po-matching');
        Route::inertia('ra-matching', 'ra-matching/index')->name('ra-matching');
    });

    Route::get('sales/report', [SalesReportController::class, 'show'])->name('sales.report');
    Route::get('sales/report/matrix', [SalesReportController::class, 'matrix'])->name('sales.report.matrix');
    Route::get('sales/report/modcon', [SalesReportController::class, 'modcon'])->name('sales.report.modcon');
    Route::get('sales/costs', [ProductCostController::class, 'index'])->name('sales.costs');
    Route::post('sales/costs', [ProductCostController::class, 'store'])->name('sales.costs.store');
    Route::post('sales/costs/import', [ProductCostController::class, 'import'])->name('sales.costs.import');
    Route::delete('sales/costs/{productCost}', [ProductCostController::class, 'destroy'])->name('sales.costs.destroy');
    Route::get('sales/liquidation', [LiquidationController::class, 'index'])->name('sales.liquidation');
    Route::get('sales/liquidation/{liquidation}/items', [LiquidationController::class, 'items'])->name('sales.liquidation.items');
    Route::post('sales/liquidation/{liquidation}/payments', [LiquidationController::class, 'storePayment'])->name('sales.liquidation.payments.store');
    Route::delete('sales/liquidation/payments/{payment}', [LiquidationController::class, 'destroyPayment'])->name('sales.liquidation.payments.destroy');
    Route::get('sales/import', [DsrImportController::class, 'create'])->name('sales.import');
    Route::post('sales/import', [DsrImportController::class, 'store'])
        ->middleware('throttle:60,1')
        ->name('sales.import.store');
    Route::post('sales/import/summary', [DsrImportController::class, 'storeSummary'])
        ->middleware('throttle:60,1')
        ->name('sales.import.summary');
    Route::post('sales/import/csr', [DsrImportController::class, 'storeCsr'])
        ->middleware('throttle:60,1')
        ->name('sales.import.csr');
    Route::post('sales/import/clr', [DsrImportController::class, 'storeClr'])
        ->middleware('throttle:60,1')
        ->name('sales.import.clr');
});

require __DIR__.'/admin.php';
require __DIR__.'/settings.php';
