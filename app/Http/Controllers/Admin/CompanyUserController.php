<?php

namespace App\Http\Controllers\Admin;

use App\Domains\Companies\Actions\CreateCompanyUser;
use App\Domains\Companies\Models\Company;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCompanyUserRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class CompanyUserController extends Controller
{
    public function store(StoreCompanyUserRequest $request, Company $company, CreateCompanyUser $createUser): RedirectResponse
    {
        $user = $createUser->handle(
            $company,
            $request->string('name')->toString(),
            $request->string('email')->toString(),
            $request->string('password')->toString(),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => "Account created for {$user->email}."]);

        return to_route('admin.companies.show', $company);
    }
}
