<?php

use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\DsrImport;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\DsrReport;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Models\Vendor;
use Inertia\Testing\AssertableInertia as Assert;

/** @return array<string, mixed> */
function dsrLine(string $code, string $qty, string $sales): array
{
    return [
        'article_code' => $code,
        'description' => "Item {$code}",
        'barcode' => '20771065'.$code,
        'uom' => 'PC',
        'sales_qty' => $qty,
        'vat_exempt_sales' => '0.00',
        'vatable_sales' => $sales,
        'total_sales' => $sales,
    ];
}

/** @return array<string, mixed> */
function dsrReport(string $site, string $date, array $lines, string $company = 'SVI', string $vendor = '900001'): array
{
    return [
        'vendor_code' => $vendor,
        'vendor_name' => "VENDOR {$vendor}",
        'site_code' => $site,
        'site_name' => "{$company} STORE {$site}",
        'company' => $company,
        'transaction_date' => $date,
        'data_status' => 'Original',
        'lines' => $lines,
    ];
}

function importDsr(array $reports, string $fileName = 'dsr.xlsx')
{
    return test()->post(route('sales.import.store'), ['file_name' => $fileName, 'reports' => $reports]);
}

beforeEach(function () {
    $this->actingAs(companyUser());
});

it('requires login', function () {
    auth()->logout();

    $this->get(route('sales.import'))->assertRedirect(route('login'));
    importDsr([dsrReport('0001', '2026-11-10', [dsrLine('A1', '1', '10.00')])])->assertRedirect(route('login'));

    expect(DsrReport::count())->toBe(0);
});

it('saves stores, items, reports and lines with exact totals', function () {
    importDsr([
        dsrReport('0001', '2026-11-10', [dsrLine('A1', '15', '294.60'), dsrLine('A2', '2.5', '39.28')]),
        dsrReport('0002', '2026-11-10', [dsrLine('A1', '1', '19.64')], 'SMCo'),
    ])->assertSessionHasNoErrors();

    expect(Site::count())->toBe(2)
        ->and(Article::count())->toBe(2)
        ->and(DsrLine::count())->toBe(3);

    $report = DsrReport::whereHas('site', fn ($q) => $q->where('code', '0001'))->sole();

    expect($report->article_count)->toBe(2)
        ->and($report->total_qty)->toBe('17.500')
        ->and($report->total_sales)->toBe('333.88');

    $import = DsrImport::sole();

    expect($import->report_count)->toBe(2)
        ->and($import->line_count)->toBe(3)
        ->and($import->replaced_count)->toBe(0)
        ->and($import->first_date->toDateString())->toBe('2026-11-10');
});

it('replaces a store-day on re-import instead of duplicating it', function () {
    importDsr([dsrReport('0001', '2026-11-10', [dsrLine('A1', '15', '294.60'), dsrLine('A2', '2', '39.28')])]);
    importDsr([dsrReport('0001', '2026-11-10', [dsrLine('A1', '16', '314.24')])], 'revised.xlsx');

    expect(DsrReport::count())->toBe(1)
        ->and(DsrLine::count())->toBe(1)
        ->and(DsrReport::sole()->total_sales)->toBe('314.24')
        ->and(DsrImport::latest('id')->first()->replaced_count)->toBe(1);
});

it('updates store and item names from the latest import', function () {
    importDsr([dsrReport('0001', '2026-11-10', [dsrLine('A1', '1', '10.00')])]);

    $renamed = dsrReport('0001', '2026-11-11', [[...dsrLine('A1', '1', '10.00'), 'description' => 'New name']]);
    $renamed['site_name'] = 'SVI RENAMED';
    importDsr([$renamed]);

    expect(Site::sole()->name)->toBe('SVI RENAMED')
        ->and(Article::sole()->description)->toBe('New name');
});

it('keeps different vendors at the same store and day apart', function () {
    importDsr([
        dsrReport('0001', '2026-11-10', [dsrLine('A1', '1', '10.00')], vendor: 'V1'),
        dsrReport('0001', '2026-11-10', [dsrLine('B1', '2', '20.00')], vendor: 'V2'),
    ])->assertSessionHasNoErrors();

    // Re-importing one vendor's day must not touch the other vendor's.
    importDsr([dsrReport('0001', '2026-11-10', [dsrLine('A1', '3', '30.00')], vendor: 'V1')]);

    expect(Vendor::count())->toBe(2)
        ->and(DsrReport::count())->toBe(2)
        ->and(DsrReport::whereRelation('vendor', 'code', 'V2')->sole()->total_sales)->toBe('20.00')
        ->and(DsrReport::whereRelation('vendor', 'code', 'V1')->sole()->total_sales)->toBe('30.00');
});

it('rejects the same store-day twice in one import and saves nothing', function () {
    $report = dsrReport('0001', '2026-11-10', [dsrLine('A1', '1', '10.00')]);

    importDsr([$report, $report])->assertSessionHasErrors('reports');

    expect(DsrReport::count())->toBe(0)->and(Site::count())->toBe(0);
});

it('rejects invalid rows', function (array $override, string $field) {
    $line = [...dsrLine('A1', '1', '10.00'), ...$override];

    importDsr([dsrReport('0001', '2026-11-10', [$line])])->assertSessionHasErrors("reports.0.lines.0.{$field}");

    expect(DsrReport::count())->toBe(0);
})->with([
    'exponent number' => [['total_sales' => '1e5'], 'total_sales'],
    'text quantity' => [['sales_qty' => 'abc'], 'sales_qty'],
    'missing article code' => [['article_code' => ''], 'article_code'],
]);

it('rejects future sales dates', function () {
    importDsr([dsrReport('0001', now()->addDay()->toDateString(), [dsrLine('A1', '1', '10.00')])])
        ->assertSessionHasErrors('reports.0.transaction_date');
});

it('shows recent imports on the import page', function () {
    importDsr([dsrReport('0001', '2026-11-10', [dsrLine('A1', '1', '10.00')])], 'november.xlsx');

    $this->get(route('sales.import'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('sales/import')
            ->has('imports', 1)
            ->where('imports.0.fileName', 'november.xlsx')
            ->where('imports.0.reportCount', 1));
});
