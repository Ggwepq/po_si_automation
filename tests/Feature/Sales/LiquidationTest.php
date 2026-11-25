<?php

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Data\DsrReportData;
use App\Domains\Sales\Models\CsrLine;
use App\Domains\Sales\Models\Liquidation;
use App\Domains\Sales\Models\LiquidationPayment;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/** [site, date, [[article, qty, sales], ...]] DSRs for testCompany(), vendor 150551. */
function seedLiquidationDsr(array $reports): void
{
    app(ImportDsrReports::class)->handle(testCompany(), array_map(fn (array $r) => DsrReportData::fromArray([
        'vendor_code' => '150551',
        'vendor_name' => 'OROZA ENTERPRISES',
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

/** One CLR head office for Nov 1-15 with stores [[site, vatable], ...]. */
function clrPayload(array $stores, string $net = '1000.00', string $center = '8888'): array
{
    return [
        'vendor_code' => '150551',
        'vendor_name' => 'OROZA ENTERPRISES',
        'center_code' => $center,
        'center_name' => 'SVI HEADOFFICE',
        'chain' => 'SVI',
        'payment_term' => 'PT38',
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-15',
        'amount_payable' => '1120.00',
        'ewt' => '10.00',
        'net_due' => $net,
        'stores' => array_map(fn (array $s) => [
            'site_code' => $s[0],
            'site_name' => "SVI STORE {$s[0]}",
            'company' => 'SVI',
            'vat_exempt_sales' => '0',
            'vatable_sales' => $s[1],
            'vat_amount' => '0',
            'total_sales' => $s[1],
        ], $stores),
    ];
}

function csrPayload(string $site, array $lines): array
{
    return [
        'vendor_code' => '150551',
        'vendor_name' => 'OROZA ENTERPRISES',
        'site_code' => $site,
        'site_name' => "SVI STORE {$site}",
        'company' => 'SVI',
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-15',
        'lines' => array_map(fn (array $l) => [
            'article_code' => $l[0],
            'description' => "Item {$l[0]}",
            'uom' => 'PC',
            'sales_qty' => $l[1],
            'vat_exempt_sales' => '0',
            'vatable_sales' => $l[2],
            'total_sales' => $l[2],
        ], $lines),
    ];
}

beforeEach(function () {
    $this->travelTo('2026-11-25');
    testCompany()->update(['account_number' => '150551']);
    $this->actingAs($this->user = companyUser());
});

it('imports a liquidation report and checks it against the DSRs', function () {
    seedLiquidationDsr([
        ['0006', '2026-11-01', [['LATTE', '10', '300.00']]],
        ['0006', '2026-11-02', [['LATTE', '10', '300.00']]],
        ['0009', '2026-11-03', [['LATTE', '5', '150.00']]],
        // Outside the period: not counted.
        ['0006', '2026-11-16', [['LATTE', '1', '30.00']]],
    ]);

    $this->post(route('sales.import.clr'), [
        'file_name' => 'CLR_DETAIL.xlsx',
        'liquidations' => [clrPayload([['0006', '600.00'], ['0009', '200.00']])],
    ])->assertSessionHasNoErrors()->assertInertiaFlash('importResult.reportCount', 1);

    $this->get(route('sales.liquidation'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('sales/liquidation')
            ->has('liquidations', 1)
            ->where('liquidations.0.chain', 'SVI')
            ->where('liquidations.0.sales', 800)
            ->where('liquidations.0.netDue', 1000)
            ->where('liquidations.0.dsrSales', 750)
            ->where('liquidations.0.dsrDifference', -50)
            ->where('liquidations.0.dsrMatches', false)
            ->where('liquidations.0.status', 'unpaid')
            ->where('liquidations.0.stores.0.code', '0006')
            ->where('liquidations.0.stores.0.difference', 0)
            ->where('liquidations.0.stores.1.code', '0009')
            ->where('liquidations.0.stores.1.difference', -50)
            // Nov 1-15: store 0009 has a DSR on Nov 3 only.
            ->has('liquidations.0.stores.1.missingDays', 14));
});

it('keeps recorded payments when a liquidation is imported again', function () {
    $payload = ['file_name' => 'CLR.xlsx', 'liquidations' => [clrPayload([['0006', '600.00']])]];
    $this->post(route('sales.import.clr'), $payload);
    $liquidation = Liquidation::sole();

    $this->post(route('sales.liquidation.payments.store', $liquidation), [
        'paid_on' => '2026-11-20', 'reference' => '8700031359', 'amount' => '400',
    ])->assertSessionHasNoErrors();

    $payload['liquidations'][0]['net_due'] = '990.00';
    $this->post(route('sales.import.clr'), $payload)->assertInertiaFlash('importResult.replacedCount', 1);

    expect(Liquidation::count())->toBe(1)
        ->and(Liquidation::sole()->net_due)->toBe('990.00')
        ->and(LiquidationPayment::sole()->liquidation_id)->toBe($liquidation->id);

    $this->get(route('sales.liquidation'))->assertInertia(fn (Assert $page) => $page
        ->where('liquidations.0.paid', 400)
        ->where('liquidations.0.balance', 590)
        ->where('liquidations.0.status', 'short')
        ->where('liquidations.0.payments.0.reference', '8700031359'));
});

it('marks a liquidation paid once payments reach the net amount due', function () {
    $this->post(route('sales.import.clr'), ['file_name' => 'CLR.xlsx', 'liquidations' => [clrPayload([['0006', '600.00']])]]);
    $liquidation = Liquidation::sole();

    foreach (['600', '399.50'] as $amount) {
        $this->post(route('sales.liquidation.payments.store', $liquidation), ['paid_on' => '2026-11-20', 'amount' => $amount]);
    }

    // Within ₱1 of the net due counts as paid.
    $this->get(route('sales.liquidation'))->assertInertia(fn (Assert $page) => $page->where('liquidations.0.status', 'paid'));

    $this->delete(route('sales.liquidation.payments.destroy', LiquidationPayment::first()))->assertRedirect();
    expect(LiquidationPayment::count())->toBe(1);
});

it('validates a payment', function (array $input, string $field) {
    $this->post(route('sales.import.clr'), ['file_name' => 'CLR.xlsx', 'liquidations' => [clrPayload([['0006', '600.00']])]]);

    $this->post(route('sales.liquidation.payments.store', Liquidation::sole()), [
        'paid_on' => '2026-11-20', 'amount' => '100', ...$input,
    ])->assertSessionHasErrors($field);
})->with([
    'future date' => [['paid_on' => '2026-12-01'], 'paid_on'],
    'zero' => [['amount' => '0'], 'amount'],
    'not money' => [['amount' => '1,000'], 'amount'],
]);

it('imports the consolidated sales report and compares items with the DSRs', function () {
    seedLiquidationDsr([
        ['0006', '2026-11-01', [['LATTE', '10', '300.00'], ['MOCHA', '2', '60.00']]],
    ]);
    $this->post(route('sales.import.clr'), ['file_name' => 'CLR.xlsx', 'liquidations' => [clrPayload([['0006', '390.00']])]]);

    $this->post(route('sales.import.csr'), [
        'file_name' => 'CSR_DETAIL.xlsx',
        'stores' => [csrPayload('0006', [['LATTE', '10', '300.00'], ['MOCHA', '3', '90.00']])],
    ])->assertSessionHasNoErrors()->assertInertiaFlash('importResult.lineCount', 2);

    // Importing the same store and period again replaces it.
    $this->post(route('sales.import.csr'), [
        'file_name' => 'CSR_DETAIL.xlsx',
        'stores' => [csrPayload('0006', [['LATTE', '10', '300.00'], ['MOCHA', '3', '90.00']])],
    ])->assertInertiaFlash('importResult.replacedCount', 1);
    expect(CsrLine::count())->toBe(2);

    $this->get(route('sales.liquidation'))->assertInertia(fn (Assert $page) => $page
        ->where('liquidations.0.csrImported', true)
        ->where('liquidations.0.stores.0.csrSales', 390));

    $this->getJson(route('sales.liquidation.items', Liquidation::sole()))
        ->assertOk()
        ->assertJsonPath('stores.0.code', '0006')
        ->assertJsonPath('stores.0.items.1.code', 'MOCHA')
        ->assertJsonPath('stores.0.items.1.csrQty', 3)
        ->assertJsonPath('stores.0.items.1.dsrQty', 2)
        ->assertJsonPath('stores.0.items.1.dsrSales', 60);
});

it('rejects another vendor\'s settlement reports', function () {
    $other = clrPayload([['0006', '600.00']]);
    $other['vendor_code'] = '80369';

    $this->post(route('sales.import.clr'), ['file_name' => 'CLR.xlsx', 'liquidations' => [$other]])
        ->assertSessionHasErrors('liquidations');
    expect(Liquidation::count())->toBe(0);
});

it('keeps each company\'s liquidations to itself', function () {
    $this->post(route('sales.import.clr'), ['file_name' => 'CLR.xlsx', 'liquidations' => [clrPayload([['0006', '600.00']])]]);
    $liquidation = Liquidation::sole();
    $this->post(route('sales.liquidation.payments.store', $liquidation), ['paid_on' => '2026-11-20', 'amount' => '100']);

    $stranger = User::factory()->for(Company::factory())->create();
    $this->actingAs($stranger);

    $this->get(route('sales.liquidation'))->assertInertia(fn (Assert $page) => $page->has('liquidations', 0));
    $this->getJson(route('sales.liquidation.items', $liquidation))->assertNotFound();
    $this->post(route('sales.liquidation.payments.store', $liquidation), ['paid_on' => '2026-11-20', 'amount' => '1'])->assertNotFound();
    $this->delete(route('sales.liquidation.payments.destroy', LiquidationPayment::sole()))->assertNotFound();
});
