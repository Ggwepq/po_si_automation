<?php

use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Actions\ImportDsrSummaries;
use App\Domains\Sales\Data\DsrReportData;
use App\Domains\Sales\Data\DsrSummaryData;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/** @param list<array{0: string, 1: string, 2: string}> $days [site, date, total] */
function dashboardSales(array $days): void
{
    app(ImportDsrReports::class)->handle(array_map(fn (array $d) => DsrReportData::fromArray([
        'vendor_code' => 'V1',
        'vendor_name' => 'VENDOR',
        'site_code' => $d[0],
        'site_name' => "SVI STORE {$d[0]}",
        'company' => 'SVI',
        'transaction_date' => $d[1],
        'lines' => [[
            'article_code' => 'A1',
            'description' => 'LATTE',
            'sales_qty' => '1',
            'vat_exempt_sales' => '0',
            'vatable_sales' => $d[2],
            'total_sales' => $d[2],
        ]],
    ]), $days), 'DSR_DETAIL.xlsx', null);
}

beforeEach(function () {
    $this->travelTo('2026-11-12');
    $this->actingAs(User::factory()->create());
});

it('shows a welcome state before any sales are imported', function () {
    $this->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('overview.hasData', false)
            ->where('overview.lastImport', null));
});

it('summarises the month of the latest sales up to that day', function () {
    dashboardSales([
        ['0001', '2026-10-31', '50.00'],
        ['0001', '2026-11-01', '100.00'],
        ['0002', '2026-11-03', '40.00'],
    ]);
    app(ImportDsrSummaries::class)->handle([DsrSummaryData::fromArray([
        'vendor_code' => 'V1', 'vendor_name' => 'VENDOR', 'site_code' => '0001', 'site_name' => 'SVI STORE 0001',
        'company' => 'SVI', 'transaction_date' => '2026-11-01', 'total_sales' => '100.00',
    ])], 'DSRS_DETAIL.xlsx', null);

    $this->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('overview.hasData', true)
            ->where('overview.period.start', '2026-11-01')
            ->where('overview.period.end', '2026-11-03')
            ->where('overview.period.month', 'November 2026')
            ->where('overview.summary.totalSales', 140)
            ->where('overview.latestDay', ['date' => '2026-11-03', 'sales' => 40])
            ->where('overview.topStores.0.code', '0001')
            ->where('overview.topItems.0.description', 'LATTE')
            ->where('overview.health.reconciled', true)
            ->where('overview.health.balanced', true)
            ->where('overview.lastImport.kind', 'summary'));
});
