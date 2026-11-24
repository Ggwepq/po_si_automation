<?php

use App\Http\Controllers\Admin\CompanyController;
use App\Http\Controllers\Admin\CompanyUserController;
use Illuminate\Support\Facades\Route;

// Super admin area: manage companies and their accounts. No company data here.
Route::middleware(['auth', 'verified', 'super-admin'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::redirect('/', '/admin/companies');

        Route::get('companies', [CompanyController::class, 'index'])->name('companies.index');
        Route::post('companies', [CompanyController::class, 'store'])->name('companies.store');
        Route::get('companies/{company:slug}', [CompanyController::class, 'show'])->name('companies.show');
        Route::post('companies/{company:slug}/users', [CompanyUserController::class, 'store'])->name('companies.users.store');
    });
