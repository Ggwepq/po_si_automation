<?php

use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Data\DsrReportData;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/** Imports DSRs directly through the action: [site, company, date, [[article, qty, sales], ...]]. */
function seedSales(array $reports): void
{
    app(ImportDsrReports::class)->handle(array_map(fn (array $r) => DsrReportData::fromArray([
        'site_code' => $r[0],
        'site_name' => "{$r[1]} STORE {$r[0]}",
        'company' => $r[1],
        'transaction_date' => $r[2],
        'lines' => array_map(fn (array $l) => [
            'article_code' => $l[0],
            'description' => "Item {$l[0]}",
            'uom' => 'PC',
            'sales_qty' => $l[1],
            'vat_exempt_sales' => '0',
            'vatable_sales' => $l[2],
            'total_sales' => $l[2],
        ], $r[3]),
    ]), $reports), 'seed.xlsx', null);
}

beforeEach(function () {
    // A fixed "today" after all seeded sales keeps the tests independent of the real date.
    $this->travelTo('2027-01-15');
    $this->actingAs(User::factory()->create());

    seedSales([
        ['0001', 'SVI', '2026-11-03', [['LATTE', '10', '300.00'], ['MOCHA', '2', '60.00']]],
        ['0002', 'SSM', '2026-11-03', [['LATTE', '5', '150.00']]],
        ['0001', 'SVI', '2026-11-05', [['MATCHA', '4', '120.00']]],
        // Previous month, for the comparison.
        ['0001', 'SVI', '2026-10-15', [['LATTE', '2', '60.00']]],
    ]);
});

it('requires login', function () {
    auth()->logout();

    $this->get(route('sales.report'))->assertRedirect(route('login'));
});

it('opens on the month of the latest imported sales', function () {
    $this->get(route('sales.report'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('sales/report')
            ->where('period.type', 'monthly')
            ->where('period.label', 'November 2026')
            ->where('period.previous.start', '2026-10-01')
            ->where('filters.companies', ['SSM', 'SVI'])
            ->where('filters.dataTo', '2026-11-05'));
});

it('totals the period and compares it with the previous one', function () {
    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.summary.totalSales', 630)
            ->where('report.summary.totalQty', 21)
            ->where('report.summary.itemCount', 3)
            ->where('report.summary.storeCount', 2)
            ->where('report.summary.salesDays', 2)
            ->where('report.summary.averageDailySales', 315)
            ->where('report.summary.previous.totalSales', 60));
});

it('ranks items with quantity, share, average price and store count', function () {
    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('report.items', 3)
            ->where('report.items.0.code', 'LATTE')
            ->where('report.items.0.qty', 15)
            ->where('report.items.0.sales', 450)
            ->where('report.items.0.share', 71.43)
            ->where('report.items.0.averagePrice', 30)
            ->where('report.items.0.storeCount', 2));
});

it('breaks sales down by store and company', function () {
    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.byStore.0.code', '0001')
            ->where('report.byStore.0.sales', 480)
            ->where('report.byStore.0.topItem', 'Item LATTE')
            ->where('report.byCompany.0.company', 'SVI')
            ->where('report.byCompany.0.share', 76.19)
            ->where('report.byCompany.1.company', 'SSM'));
});

it('filters by company and by store', function () {
    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01', 'company' => 'SSM']))
        ->assertInertia(fn (Assert $page) => $page->where('report.summary.totalSales', 150));

    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01', 'site' => '0001']))
        ->assertInertia(fn (Assert $page) => $page->where('report.summary.totalSales', 480));
});

it('fills days without sales in the daily trend', function () {
    $this->get(route('sales.report', ['period' => 'weekly', 'date' => '2026-11-03']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('period.start', '2026-11-02')
            ->where('report.trend.grouping', 'day')
            ->has('report.trend.points', 7)
            ->where('report.trend.points.1.sales', 510)
            ->where('report.trend.points.2.sales', 0));
});

it('leaves days after today out of the trend', function () {
    $this->travelTo('2026-11-04');

    $this->get(route('sales.report', ['period' => 'weekly', 'date' => '2026-11-03']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('report.trend.points', 3)
            ->where('report.trend.points.2.date', '2026-11-04'));
});

it('groups yearly trends by month', function () {
    $this->get(route('sales.report', ['period' => 'yearly', 'date' => '2026-01-01']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.trend.grouping', 'month')
            ->has('report.trend.points', 12)
            ->where('report.trend.points.10.sales', 630));
});

it('refreshes cached reports after a new import', function () {
    $this->get(route('sales.report', ['period' => 'daily', 'date' => '2026-11-04']))
        ->assertInertia(fn (Assert $page) => $page->where('report.summary.totalSales', 0));

    seedSales([['0002', 'SSM', '2026-11-04', [['LATTE', '1', '30.00']]]]);

    $this->get(route('sales.report', ['period' => 'daily', 'date' => '2026-11-04']))
        ->assertInertia(fn (Assert $page) => $page->where('report.summary.totalSales', 30));
});

it('validates the period', function (array $query, string $field) {
    $this->get(route('sales.report', $query))->assertSessionHasErrors($field);
})->with([
    'unknown period' => [['period' => 'hourly'], 'period'],
    'custom without end' => [['period' => 'custom', 'date' => '2026-11-01'], 'end'],
    'end before start' => [['period' => 'custom', 'date' => '2026-11-10', 'end' => '2026-11-01'], 'end'],
    'range too long' => [['period' => 'custom', 'date' => '2020-01-01', 'end' => '2026-01-01'], 'end'],
]);
