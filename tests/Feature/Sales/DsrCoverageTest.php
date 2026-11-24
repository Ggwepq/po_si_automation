<?php

use App\Domains\Sales\Actions\CheckDsrCoverage;
use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Data\DsrReportData;
use App\Domains\Sales\Data\ReportFilter;
use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Enums\PeriodType;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

/** One DSR per [site, company, date]; contents do not matter for coverage. */
function seedDays(array $storeDays): void
{
    app(ImportDsrReports::class)->handle(testCompany(), array_map(fn (array $d) => DsrReportData::fromArray([
        'vendor_code' => 'V1',
        'vendor_name' => 'VENDOR',
        'site_code' => $d[0],
        'site_name' => "{$d[1]} STORE {$d[0]}",
        'company' => $d[1],
        'transaction_date' => $d[2],
        'lines' => [[
            'article_code' => 'A1',
            'description' => 'Item',
            'sales_qty' => '1',
            'vat_exempt_sales' => '0',
            'vatable_sales' => '10',
            'total_sales' => '10',
        ]],
    ]), $storeDays), 'seed.xlsx', null);
}

function coverage(string $type, string $date, ?ReportFilter $filter = null): array
{
    return app(CheckDsrCoverage::class)->handle(
        ReportPeriod::containing(PeriodType::from($type), CarbonImmutable::parse($date)),
        $filter ?? new ReportFilter(testCompany()->id),
    );
}

beforeEach(function () {
    $this->travelTo('2026-11-11');
});

it('lists missing days per store and days with no DSR at all', function () {
    seedDays([
        ['0001', 'SVI', '2026-11-02'], ['0001', 'SVI', '2026-11-03'], ['0001', 'SVI', '2026-11-05'],
        ['0002', 'SSM', '2026-11-02'], ['0002', 'SSM', '2026-11-05'],
    ]);

    $result = coverage('weekly', '2026-11-02'); // Mon Nov 2 – Sun Nov 8

    expect($result['mode'])->toBe('day')
        ->and($result['daysChecked'])->toBe(7)
        ->and($result['daysWithoutAnyDsr'])->toBe(['2026-11-04', '2026-11-06', '2026-11-07', '2026-11-08'])
        ->and($result['complete'])->toBeFalse()
        ->and($result['stores'][0])->toMatchArray([
            'code' => '0002',
            'importedDays' => 2,
            'missing' => ['2026-11-03', '2026-11-04', '2026-11-06', '2026-11-07', '2026-11-08'],
        ])
        ->and($result['stores'][1]['code'])->toBe('0001');
});

it('includes a store active last period but missing this one', function () {
    seedDays([['0001', 'SVI', '2026-10-20'], ['0002', 'SSM', '2026-11-03']]);

    $codes = array_column(coverage('monthly', '2026-11-01')['stores'], 'importedDays', 'code');

    expect($codes)->toBe(['0002' => 1, '0001' => 0]);
});

it('checks days up to yesterday, since SM posts a DSR the next day', function () {
    seedDays([['0001', 'SVI', '2026-11-10']]);

    $result = coverage('monthly', '2026-11-01'); // today is Nov 11

    expect($result['daysChecked'])->toBe(10)
        ->and(last($result['stores'][0]['missing']))->toBe('2026-11-09');
});

it('is complete only when every expected store has every day', function () {
    $range = fn () => app(CheckDsrCoverage::class)->handle(
        ReportPeriod::containing(PeriodType::Custom, CarbonImmutable::parse('2026-11-09'), CarbonImmutable::parse('2026-11-10')),
        new ReportFilter(testCompany()->id),
    );

    seedDays([['0001', 'SVI', '2026-11-09']]);
    expect($range()['complete'])->toBeFalse();

    seedDays([['0001', 'SVI', '2026-11-10']]);
    expect($range()['complete'])->toBeTrue();
});

it('summarises long periods per month', function () {
    seedDays([['0001', 'SVI', '2026-01-05'], ['0001', 'SVI', '2026-01-06'], ['0001', 'SVI', '2026-02-01']]);

    $result = coverage('yearly', '2026-01-01');

    expect($result['mode'])->toBe('month')
        ->and($result['stores'][0]['months'][0])->toBe(['month' => '2026-01', 'imported' => 2, 'days' => 31])
        ->and($result['stores'][0]['months'][10])->toBe(['month' => '2026-11', 'imported' => 0, 'days' => 10]);
});

it('respects the company filter', function () {
    seedDays([['0001', 'SVI', '2026-11-02'], ['0002', 'SSM', '2026-11-02']]);

    $stores = coverage('daily', '2026-11-02', new ReportFilter(testCompany()->id, companies: ['SSM']))['stores'];

    expect(array_column($stores, 'code'))->toBe(['0002']);
});

it('is part of the sales report page', function () {
    $this->actingAs(companyUser());
    seedDays([['0001', 'SVI', '2026-11-02']]);

    $this->get(route('sales.report', ['period' => 'daily', 'date' => '2026-11-02']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('coverage.complete', true)
            ->where('coverage.stores.0.code', '0001'));
});
