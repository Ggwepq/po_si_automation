<?php

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Data\DsrReportData;

/** [site, date, [[article, qty, sales], ...]] for $company (default: testCompany()). */
function seedMatrix(array $reports, ?Company $company = null): void
{
    app(ImportDsrReports::class)->handle($company ?? testCompany(), array_map(fn (array $r) => DsrReportData::fromArray([
        'vendor_code' => 'V1',
        'vendor_name' => 'VENDOR V1',
        'site_code' => $r[0],
        'site_name' => "SVI STORE {$r[0]}",
        'company' => 'SVI',
        'transaction_date' => $r[1],
        'lines' => array_map(fn (array $l) => [
            'article_code' => $l[0],
            'description' => "Item {$l[0]}",
            'uom' => 'PC',
            'sales_qty' => $l[1],
            'vat_exempt_sales' => '0',
            'vatable_sales' => $l[2],
            'total_sales' => $l[2],
        ], $r[2]),
    ]), $reports), 'seed.xlsx', null);
}

beforeEach(function () {
    $this->travelTo('2027-01-15');
});

it('requires a company user', function () {
    $this->getJson(route('sales.report.matrix'))->assertUnauthorized();
});

it('grids quantity and sales per item for every day and every store', function () {
    seedMatrix([
        ['0002', '2026-11-03', [['20586496', '2', '39.28'], ['20586495', '10', '196.40']]],
        ['0001', '2026-11-03', [['20586495', '5', '98.20']]],
        ['0001', '2026-11-05', [['20586496', '1', '19.64']]],
    ]);

    $matrix = $this->actingAs(companyUser())
        ->getJson(route('sales.report.matrix', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertOk()
        ->json();

    expect($matrix['grouping'])->toBe('day')
        // Items in SM article-code order.
        ->and(array_column($matrix['items'], 'code'))->toBe(['20586495', '20586496'])
        // Every day of the month, with zeros on days without sales.
        ->and($matrix['byDate'])->toHaveCount(30)
        ->and($matrix['byDate'][0])->toEqual(['date' => '2026-11-01', 'qty' => [0, 0], 'sales' => [0, 0]])
        ->and($matrix['byDate'][2])->toEqual(['date' => '2026-11-03', 'qty' => [15, 2], 'sales' => [294.6, 39.28]])
        ->and($matrix['byDate'][4])->toEqual(['date' => '2026-11-05', 'qty' => [0, 1], 'sales' => [0, 19.64]])
        ->and($matrix['byStore'])->toEqual([
            ['code' => '0001', 'name' => 'SVI STORE 0001', 'company' => 'SVI', 'qty' => [5, 1], 'sales' => [98.2, 19.64]],
            ['code' => '0002', 'name' => 'SVI STORE 0002', 'company' => 'SVI', 'qty' => [10, 2], 'sales' => [196.4, 39.28]],
        ]);
});

it('groups long periods by month', function () {
    seedMatrix([
        ['0001', '2026-10-03', [['A1', '1', '10.00']]],
        ['0001', '2026-10-20', [['A1', '2', '20.00']]],
    ]);

    $matrix = $this->actingAs(companyUser())
        ->getJson(route('sales.report.matrix', ['period' => 'yearly', 'date' => '2026-01-01']))
        ->json();

    expect($matrix['grouping'])->toBe('month')
        ->and($matrix['byDate'])->toHaveCount(12)
        ->and($matrix['byDate'][9])->toEqual(['date' => '2026-10', 'qty' => [3], 'sales' => [30]]);
});

it('leaves out other companies\' sales', function () {
    seedMatrix([['0001', '2026-11-03', [['A1', '1', '10.00']]]]);
    seedMatrix([['0009', '2026-11-03', [['B9', '7', '70.00']]]], Company::factory()->create());

    $matrix = $this->actingAs(companyUser())
        ->getJson(route('sales.report.matrix', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->json();

    expect(array_column($matrix['items'], 'code'))->toBe(['A1'])
        ->and(array_column($matrix['byStore'], 'code'))->toBe(['0001']);
});
