<?php

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Actions\ImportDsrSummaries;
use App\Domains\Sales\Data\DsrReportData;
use App\Domains\Sales\Data\DsrSummaryData;
use App\Domains\Sales\Models\DsrReport;
use App\Domains\Sales\Models\DsrSummary;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

/** One DSR for store 0001 on 2026-11-03, imported for $company. */
function importFor(Company $company, string $sales, string $vendor = 'V1'): void
{
    app(ImportDsrReports::class)->handle($company, [DsrReportData::fromArray([
        'vendor_code' => $vendor,
        'vendor_name' => "VENDOR {$vendor}",
        'site_code' => '0001',
        'site_name' => 'SVI STORE 0001',
        'company' => 'SVI',
        'transaction_date' => '2026-11-03',
        'lines' => [[
            'article_code' => 'A1',
            'description' => 'Item A1',
            'sales_qty' => '1',
            'vat_exempt_sales' => '0',
            'vatable_sales' => $sales,
            'total_sales' => $sales,
        ]],
    ])], 'dsr.xlsx', null);
}

beforeEach(function () {
    $this->travelTo('2027-01-15');
});

it('shows each company only its own sales, filters and imports', function () {
    $other = Company::factory()->create();
    importFor($other, '999.00', 'OTHER');
    importFor(testCompany(), '10.00');

    $this->actingAs(companyUser())
        ->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.summary.totalSales', 10)
            ->where('filters.vendors', [['code' => 'V1', 'name' => 'VENDOR V1']]));

    $this->get(route('sales.import'))
        ->assertInertia(fn (Assert $page) => $page->has('imports', 1));
});

it('shows a company with no imports an empty report', function () {
    importFor(Company::factory()->create(), '999.00');

    $this->actingAs(companyUser())
        ->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.summary.totalSales', 0)
            ->where('filters.vendors', [])
            ->where('filters.sites', [])
            ->where('filters.dataTo', null));
});

it('never lets one company replace another company\'s store-day', function () {
    $other = Company::factory()->create();
    importFor($other, '999.00');
    importFor(testCompany(), '10.00');
    importFor(testCompany(), '12.00');

    expect(DsrReport::where('company_id', $other->id)->sole()->total_sales)->toBe('999.00')
        ->and(DsrReport::where('company_id', testCompany()->id)->sole()->total_sales)->toBe('12.00');

    $summary = fn (Company $company, string $total) => app(ImportDsrSummaries::class)->handle($company, [DsrSummaryData::fromArray([
        'vendor_code' => 'V1', 'vendor_name' => 'VENDOR V1', 'site_code' => '0001', 'site_name' => 'SVI STORE 0001',
        'company' => 'SVI', 'transaction_date' => '2026-11-03', 'total_sales' => $total,
    ])], 'DSRS_DETAIL.xlsx', null);
    $summary($other, '999.00');
    $summary(testCompany(), '12.00');

    expect(DsrSummary::where('company_id', $other->id)->sole()->total_sales)->toBe('999.00')
        ->and(DsrSummary::count())->toBe(2);
});

it('saves imports to the signed-in user\'s company', function () {
    $this->actingAs(companyUser())
        ->post(route('sales.import.store'), ['file_name' => 'dsr.xlsx', 'reports' => [[
            'vendor_code' => 'V1', 'vendor_name' => 'VENDOR V1', 'site_code' => '0001', 'site_name' => 'SVI STORE 0001',
            'company' => 'SVI', 'transaction_date' => '2026-11-03', 'data_status' => 'Original',
            'lines' => [['article_code' => 'A1', 'description' => 'Item', 'barcode' => null, 'uom' => 'PC',
                'sales_qty' => '1', 'vat_exempt_sales' => '0.00', 'vatable_sales' => '10.00', 'total_sales' => '10.00']],
        ]]])
        ->assertSessionHasNoErrors();

    expect(DsrReport::sole()->company_id)->toBe(testCompany()->id);
});

it('refuses company pages to an account without a company', function () {
    $user = User::factory()->create(['company_id' => null]);

    $this->actingAs($user)->get(route('dashboard'))->assertForbidden();
    $this->actingAs($user)->get(route('sales.report'))->assertForbidden();
});

it('shares the company brand with the page', function () {
    $this->actingAs(companyUser())
        ->get(route('sales.report'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.isSuperAdmin', false)
            ->where('auth.company.name', testCompany()->name)
            // The sidebar's DSR status, before any import.
            ->where('sales.lastDsrDate', null)
            ->where('sales.importLimits.reportsPerBatch', 300));
});

it('only accepts DSRs for the company\'s own vendor number', function () {
    $company = Company::factory()->create(['name' => 'Oroza Enterprise', 'account_number' => '150551']);

    expect(fn () => importFor($company, '10.00', '80369'))
        ->toThrow(ValidationException::class, "This file is for vendor 80369, but Oroza Enterprise's account number is 150551.");

    importFor($company, '10.00', '150551');

    expect(DsrReport::where('company_id', $company->id)->count())->toBe(1);
});

it('only accepts DSR Summaries for the company\'s own vendor number', function () {
    $company = Company::factory()->create(['account_number' => '150551']);
    $summary = fn (string $vendor) => app(ImportDsrSummaries::class)->handle($company, [DsrSummaryData::fromArray([
        'vendor_code' => $vendor, 'vendor_name' => 'VENDOR', 'site_code' => '0001', 'site_name' => 'SVI STORE 0001',
        'company' => 'SVI', 'transaction_date' => '2026-11-03', 'total_sales' => '10.00',
    ])], 'DSRS_DETAIL.xlsx', null);

    expect(fn () => $summary('80369'))->toThrow(ValidationException::class);

    $summary('150551');

    expect(DsrSummary::count())->toBe(1);
});
