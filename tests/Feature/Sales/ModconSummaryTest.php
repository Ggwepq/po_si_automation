<?php

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Data\DsrReportData;

/** [site, chain, date, [[article, qty, sales], ...]] for $company (default: testCompany()). */
function seedModcon(array $reports, ?Company $company = null): void
{
    app(ImportDsrReports::class)->handle($company ?? testCompany(), array_map(fn (array $r) => DsrReportData::fromArray([
        'vendor_code' => 'V1',
        'vendor_name' => 'VENDOR V1',
        'site_code' => $r[0],
        'site_name' => "{$r[1]} STORE {$r[0]}",
        'company' => $r[1],
        'transaction_date' => $r[2],
        'lines' => array_map(fn (array $l) => [
            'article_code' => $l[0],
            'description' => "Item {$l[0]}",
            'sales_qty' => $l[1],
            'vat_exempt_sales' => '0',
            'vatable_sales' => $l[2],
            'total_sales' => $l[2],
        ], $r[3]),
    ]), $reports), 'seed.xlsx', null);
}

beforeEach(function () {
    $this->travelTo('2027-01-15');
});

it('requires login', function () {
    $this->getJson(route('sales.report.modcon'))->assertUnauthorized();
});

it('sums each chain\'s items per half-month of the report\'s year', function () {
    seedModcon([
        // Two SSM stores on the 15th (first half) and one on the 16th (second half).
        ['0001', 'SSM', '2026-08-15', [['20586495', '10', '196.40']]],
        ['0002', 'SSM', '2026-08-15', [['20586495', '5', '98.20'], ['20586496', '1', '19.64']]],
        ['0001', 'SSM', '2026-08-16', [['20586495', '1', '19.64']]],
        ['0003', 'SVI', '2026-01-31', [['20586496', '2', '39.28']]],
        // Another year is left out.
        ['0003', 'SVI', '2025-12-31', [['20586496', '9', '176.76']]],
    ]);

    $summary = $this->actingAs(companyUser())
        ->getJson(route('sales.report.modcon', ['period' => 'monthly', 'date' => '2026-08-01']))
        ->assertOk()
        ->json();

    expect($summary['year'])->toBe(2026)
        ->and(array_column($summary['items'], 'code'))->toBe(['20586495', '20586496'])
        ->and(array_column($summary['chains'], 'chain'))->toBe(['SSM', 'SVI']);

    [$ssm, $svi] = $summary['chains'];

    // August 1–15 is half 14, August 16–31 is half 15.
    expect($ssm['amount'][0][14])->toEqual(294.6)
        ->and($ssm['qty'][0][14])->toEqual(15)
        ->and($ssm['amount'][0][15])->toEqual(19.64)
        ->and($ssm['amount'][1][14])->toEqual(19.64)
        ->and($svi['amount'][1][1])->toEqual(39.28)
        ->and(array_sum($svi['qty'][1]))->toEqual(2)
        ->and($ssm['amount'][0])->toHaveCount(24);
});

it('leaves out other companies\' sales', function () {
    seedModcon([['0001', 'SSM', '2026-08-15', [['A1', '1', '10.00']]]]);
    seedModcon([['0009', 'SMCo', '2026-08-15', [['B9', '7', '70.00']]]], Company::factory()->create());

    $summary = $this->actingAs(companyUser())
        ->getJson(route('sales.report.modcon', ['period' => 'monthly', 'date' => '2026-08-01']))
        ->json();

    expect(array_column($summary['chains'], 'chain'))->toBe(['SSM'])
        ->and(array_column($summary['items'], 'code'))->toBe(['A1']);
});
