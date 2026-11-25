<?php

namespace App\Http\Controllers\Admin;

use App\Domains\Companies\Actions\CreateCompany;
use App\Domains\Companies\Models\Company;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCompanyRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    private const PER_PAGE = 25;

    public function index(): Response
    {
        return Inertia::render('admin/companies/index', [
            'companies' => Company::query()
                ->withCount('users')
                ->orderBy('name')
                ->paginate(self::PER_PAGE)
                ->through(fn (Company $company) => [
                    ...$company->toBrand(),
                    'userCount' => $company->users_count,
                    'createdAt' => $company->created_at?->toIso8601String(),
                ]),
        ]);
    }

    public function store(StoreCompanyRequest $request, CreateCompany $createCompany): RedirectResponse
    {
        $company = $createCompany->handle(
            $request->string('name')->toString(),
            $request->string('account_number')->toString(),
            $request->logo(),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$company->name} added. Now add its users."]);

        return to_route('admin.companies.show', $company);
    }

    public function show(Company $company): Response
    {
        return Inertia::render('admin/companies/show', [
            'company' => $company->toBrand(),
            'users' => $company->users()
                ->orderBy('name')
                ->paginate(self::PER_PAGE, ['id', 'name', 'email', 'created_at'])
                ->through(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'createdAt' => $user->created_at?->toIso8601String(),
                ]),
        ]);
    }
}
