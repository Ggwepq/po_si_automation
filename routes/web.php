<?php

use Illuminate\Support\Facades\Route;

// Internal tool: there is no public landing page. Guests are sent to log in.
Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Workbook tools run entirely in the browser; the server only serves the page.
    Route::inertia('po-matching', 'po-matching/index')->name('po-matching');
    Route::inertia('ra-matching', 'ra-matching/index')->name('ra-matching');
});

require __DIR__.'/settings.php';
