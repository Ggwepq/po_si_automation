<?php

use App\Domains\Sales\Actions\CheckDsrCoverage;
use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Actions\ImportDsrSummaries;
use App\Domains\Sales\Actions\ReconcileDsr;
use App\Domains\Sales\Data\DsrReportData;
use App\Domains\Sales\Data\DsrSummaryData;
use App\Domains\Sales\Data\ReportFilter;
use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Enums\ImportKind;
use App\Domains\Sales\Enums\PeriodType;
use App\Domains\Sales\Models\DsrImport;
use App\Domains\Sales\Models\DsrSummary;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

/** @param list<array{0: string, 1: string, 2: string}> $rows [site, date, total] */
function summaryRows(array $rows, string $vendor = 'V1'): array
{
    return array_map(fn (array $r) => [
        'vendor_code' => $vendor,
        'vendor_name' => "VENDOR {$vendor}",
        'site_code' => $r[0],
        'site_name' => "SVI STORE {$r[0]}",
        'company' => 'SVI',
        'transaction_date' => $r[1],
        'total_sales' => $r[2],
    ], $rows);
}

function importSummaries(array $rows): DsrImport
{
    return app(ImportDsrSummaries::class)->handle(testCompany(), array_map(DsrSummaryData::fromArray(...), summaryRows($rows)), 'DSRS_DETAIL.xlsx', null);
}

/** @param list<array{0: string, 1: string, 2: list<string>}> $days [site, date, line totals] */
function importDetail(array $days): void
{
    app(ImportDsrReports::class)->handle(testCompany(), array_map(fn (array $d) => DsrReportData::fromArray([
        'vendor_code' => 'V1',
        'vendor_name' => 'VENDOR V1',
        'site_code' => $d[0],
        'site_name' => "SVI STORE {$d[0]}",
        'company' => 'SVI',
        'transaction_date' => $d[1],
        'lines' => array_map(fn (string $total, int $i) => [
            'article_code' => "A{$i}",
            'description' => "Item {$i}",
            'sales_qty' => '1',
            'vat_exempt_sales' => '0',
            'vatable_sales' => $total,
            'total_sales' => $total,
        ], $d[2], array_keys($d[2])),
    ]), $days), 'DSR_DETAIL.xlsx', null);
}

function reconcile(string $date = '2026-10-01', ?ReportFilter $filter = null): array
{
    return app(ReconcileDsr::class)->handle(ReportPeriod::containing(PeriodType::Monthly, CarbonImmutable::parse($date)), $filter ?? new ReportFilter(testCompany()->id));
}

beforeEach(function () {
    $this->travelTo('2026-11-11');
});

it('saves summaries once per store-day and replaces them on re-import', function () {
    importSummaries([['0001', '2026-10-01', '100.50'], ['0001', '2026-10-02', '0.00']]);
    $second = importSummaries([['0001', '2026-10-01', '120.00']]);

    expect(DsrSummary::count())->toBe(2)
        ->and(DsrSummary::orderBy('transaction_date')->value('total_sales'))->toBe('120.00')
        ->and($second->kind)->toBe(ImportKind::Summary)
        ->and($second->replaced_count)->toBe(1);
});

it('rejects a summary file listing the same store-day twice', function () {
    importSummaries([['0001', '2026-10-01', '1.00'], ['0001', '2026-10-01', '2.00']]);
})->throws(ValidationException::class);

it('matches, flags and explains every store-day of the month', function () {
    importSummaries([
        ['0001', '2026-10-01', '30.25'],  // match (10.10 + 20.15)
        ['0001', '2026-10-02', '50.00'],  // differs: DSR says 45.00
        ['0001', '2026-10-03', '0.00'],   // no sales
        ['0002', '2026-10-01', '75.00'],  // DSR not imported
    ]);
    importDetail([
        ['0001', '2026-10-01', ['10.10', '20.15']],
        ['0001', '2026-10-02', ['45.00']],
        ['0002', '2026-10-02', ['5.00']],  // not in summary (summary covers Oct 2)
        ['0003', '2026-10-20', ['9.00']],  // vendor-day not in any summary: not checked
    ]);

    $result = reconcile();

    expect($result['checked'])->toBeTrue()
        ->and($result['balanced'])->toBeFalse()
        ->and($result['counts'])->toBe(['match' => 1, 'no_sales' => 1, 'differs' => 1, 'not_imported' => 1, 'not_in_summary' => 1])
        ->and($result['summaryTotal'])->toBe('155.25')
        ->and($result['detailTotal'])->toBe('80.25')
        ->and($result['difference'])->toBe('-75.00')
        ->and(array_column($result['issues'], 'status'))->toBe(['not_imported', 'differs', 'not_in_summary'])
        ->and($result['issues'][1])->toMatchArray(['siteCode' => '0001', 'summary' => '50.00', 'detail' => '45.00', 'difference' => '-5.00'])
        ->and($result['stores'][0])->toMatchArray(['code' => '0002', 'issues' => 2]);
});

it('is balanced when every store-day matches', function () {
    importSummaries([['0001', '2026-10-01', '30.25'], ['0001', '2026-10-02', '0.00']]);
    importDetail([['0001', '2026-10-01', ['10.10', '20.15']]]);

    expect(reconcile())->toMatchArray(['balanced' => true, 'difference' => '0.00', 'daysChecked' => 2]);
});

it('reports a month without a summary as not checked', function () {
    importDetail([['0001', '2026-10-01', ['10.00']]]);

    expect(reconcile())->toMatchArray(['checked' => false, 'balanced' => false]);
});

it('honours the store filter', function () {
    importSummaries([['0001', '2026-10-01', '10.00'], ['0002', '2026-10-01', '99.00']]);
    importDetail([['0001', '2026-10-01', ['10.00']]]);

    expect(reconcile('2026-10-01', new ReportFilter(testCompany()->id, siteCodes: ['0001'])))->toMatchArray(['balanced' => true]);
});

it('counts summary days of 0.00 as no sales in data completeness', function () {
    importSummaries([['0001', '2026-11-02', '0.00'], ['0001', '2026-11-03', '10.00']]);
    importDetail([['0001', '2026-11-03', ['10.00']]]);

    $coverage = app(CheckDsrCoverage::class)->handle(
        ReportPeriod::containing(PeriodType::Custom, CarbonImmutable::parse('2026-11-02'), CarbonImmutable::parse('2026-11-03')),
        new ReportFilter(testCompany()->id),
    );

    expect($coverage['complete'])->toBeTrue()
        ->and($coverage['stores'][0])->toMatchArray(['importedDays' => 1, 'noSalesDays' => 1, 'missing' => []]);
});

it('treats a store left out of the summary for a day as no sales', function () {
    importDetail([['0001', '2026-11-02', ['10.00']], ['0002', '2026-11-02', ['5.00']], ['0001', '2026-11-03', ['10.00']]]);
    importSummaries([['0001', '2026-11-02', '10.00'], ['0002', '2026-11-02', '5.00'], ['0001', '2026-11-03', '10.00']]);

    $coverage = app(CheckDsrCoverage::class)->handle(
        ReportPeriod::containing(PeriodType::Custom, CarbonImmutable::parse('2026-11-02'), CarbonImmutable::parse('2026-11-04')),
        new ReportFilter(testCompany()->id),
    );
    $store = collect($coverage['stores'])->firstWhere('code', '0002');

    // Nov 3 is covered by the Summary without store 0002; Nov 4 has no Summary yet.
    expect($store)->toMatchArray(['noSales' => ['2026-11-03'], 'missing' => ['2026-11-04']])
        ->and($coverage['daysWithoutAnyDsr'])->toBe(['2026-11-04']);
});

it('flags a day whose summary shows sales but has no DSR imported', function () {
    importSummaries([['0001', '2026-11-02', '10.00'], ['0001', '2026-11-03', '0.00']]);

    $coverage = app(CheckDsrCoverage::class)->handle(
        ReportPeriod::containing(PeriodType::Custom, CarbonImmutable::parse('2026-11-02'), CarbonImmutable::parse('2026-11-03')),
        new ReportFilter(testCompany()->id),
    );

    expect($coverage['daysWithoutAnyDsr'])->toBe(['2026-11-02'])
        ->and($coverage['stores'][0])->toMatchArray(['missing' => ['2026-11-02'], 'noSales' => ['2026-11-03']]);
});

it('imports a summary through the import page', function () {
    $this->actingAs(companyUser())
        ->post(route('sales.import.summary'), ['file_name' => 'DSRS_DETAIL.xlsx', 'summaries' => summaryRows([['0001', '2026-10-01', '12.50']])])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect(DsrSummary::count())->toBe(1);
});

it('rejects summary amounts that are not plain decimals', function () {
    $this->actingAs(companyUser())
        ->post(route('sales.import.summary'), ['file_name' => 'x.xlsx', 'summaries' => summaryRows([['0001', '2026-10-01', '1e5']])])
        ->assertSessionHasErrors('summaries.0.total_sales');
});

it('requires login to import a summary', function () {
    $this->post(route('sales.import.summary'), [])->assertRedirect(route('login'));
});

it('sends the reconciliation to the sales report', function () {
    importSummaries([['0001', '2026-10-01', '10.00']]);

    $this->actingAs(companyUser())
        ->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-10-01']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('reconciliation.checked', true)
            ->where('reconciliation.counts.not_imported', 1));
});
