<?php

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Data\DsrReportData;
use App\Domains\Sales\Models\ProductCost;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/** [site, date, [[article, qty, sales], ...]] for $company (default: testCompany()). */
function seedCostSales(array $reports, ?Company $company = null): void
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

function setCost(string $code, string $cost, string $from): void
{
    test()->post(route('sales.costs.store'), [
        'article_code' => $code,
        'unit_cost' => $cost,
        'effective_from' => $from,
    ])->assertSessionHasNoErrors();
}

beforeEach(function () {
    $this->travelTo('2027-01-15');
    $this->actingAs($this->user = companyUser());

    seedCostSales([
        ['0001', '2026-11-03', [['LATTE', '10', '300.00'], ['MOCHA', '2', '60.00']]],
        ['0002', '2026-11-20', [['LATTE', '5', '150.00']]],
    ]);
});

it('lists the sold items with their SM price and no cost yet', function () {
    $this->get(route('sales.costs'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('sales/costs')
            ->has('products', 2)
            ->where('products.0.code', 'LATTE')
            ->where('products.0.smPrice', 30)
            ->where('products.0.currentCost', null)
            ->where('products.0.margin', null)
            ->where('products.0.recentSales', 450)
            ->where('products.1.recentSales', 60));
});

it('shows no gross profit until costs are set', function () {
    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.summary.grossProfit', null)
            ->where('report.summary.costCoverage', 0));
});

it('works out gross profit with the cost in effect on each sale date', function () {
    setCost('LATTE', '20', '2026-11-01');
    // A cost increase from Nov 15: only the Nov 20 sale uses it.
    setCost('LATTE', '24.50', '2026-11-15');

    // LATTE: 10 × 20 + 5 × 24.50 = 322.50 cost on 450 sales. MOCHA has no cost.
    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.summary.grossProfit', 127.5)
            ->where('report.summary.grossMargin', 28.33)
            ->where('report.summary.costCoverage', 88.24)
            ->where('report.items.0.code', 'LATTE')
            ->where('report.items.0.grossProfit', 127.5)
            ->where('report.items.1.grossProfit', null)
            ->where('report.byStore.0.code', '0001')
            ->where('report.byStore.0.grossProfit', 100)
            ->where('report.byStore.1.grossProfit', 27.5));

    $this->get(route('sales.costs'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('products.0.currentCost', 24.5)
            ->where('products.0.margin', 18.33)
            ->has('products.0.history', 2)
            ->where('products.0.history.0.effectiveFrom', '2026-11-15'));
});

it('ignores a cost that starts after the sale', function () {
    setCost('LATTE', '20', '2026-12-01');

    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page->where('report.summary.grossProfit', null));
});

it('corrects a cost set again for the same date', function () {
    setCost('LATTE', '20', '2026-11-01');
    setCost('LATTE', '25', '2026-11-01');

    expect(ProductCost::count())->toBe(1)
        ->and((float) ProductCost::first()->unit_cost)->toBe(25.0)
        ->and(ProductCost::first()->user_id)->toBe($this->user->id);
});

it('refreshes the report after a cost changes', function () {
    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']));
    setCost('LATTE', '20', '2026-11-01');

    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page->where('report.items.0.grossProfit', 150));
});

it('removes a cost', function () {
    setCost('LATTE', '20', '2026-11-01');

    $this->delete(route('sales.costs.destroy', ProductCost::first()))->assertRedirect();

    expect(ProductCost::count())->toBe(0);
    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page->where('report.summary.grossProfit', null));
});

it('validates the cost', function (array $input, string $field) {
    $this->post(route('sales.costs.store'), [
        'article_code' => 'LATTE',
        'unit_cost' => '20',
        'effective_from' => '2026-11-01',
        ...$input,
    ])->assertSessionHasErrors($field);
})->with([
    'unknown item' => [['article_code' => 'NOPE'], 'article_code'],
    'negative cost' => [['unit_cost' => '-1'], 'unit_cost'],
    'not a number' => [['unit_cost' => 'abc'], 'unit_cost'],
    'bad date' => [['effective_from' => '11/01/2026'], 'effective_from'],
]);

it('keeps each company\'s costs separate', function () {
    $other = Company::factory()->create();
    seedCostSales([['0001', '2026-11-03', [['LATTE', '10', '300.00']]]], $other);
    $otherUser = User::factory()->for($other)->create();

    // Our cost does not touch the other company's profit.
    setCost('LATTE', '20', '2026-11-01');
    $otherCost = ProductCost::first();

    $this->actingAs($otherUser)
        ->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page->where('report.summary.grossProfit', null));

    // Nor can the other company remove our cost.
    $this->delete(route('sales.costs.destroy', $otherCost))->assertNotFound();
    expect(ProductCost::count())->toBe(1);
});

it('is not for super admins', function () {
    $this->actingAs(User::factory()->superAdmin()->create())
        ->get(route('sales.costs'))
        ->assertRedirect();
});

it('imports costs from a cost sheet, skipping items not in any DSR', function () {
    setCost('LATTE', '18', '2026-11-01');

    $this->post(route('sales.costs.import'), [
        'effective_from' => '2026-11-01',
        'costs' => [
            ['article_code' => 'LATTE', 'unit_cost' => '20'],
            ['article_code' => 'MOCHA', 'unit_cost' => '12.5'],
            ['article_code' => '20589631', 'unit_cost' => '18'],
        ],
    ])->assertRedirect()->assertInertiaFlash('toast.type', 'warning')
        ->assertInertiaFlash('toast.message', 'Costs saved for 2 items. Skipped 1 not in any DSR yet: 20589631.');

    // LATTE's Nov 1 cost is replaced, not duplicated.
    expect(ProductCost::count())->toBe(2);

    // LATTE 450 - 15 × 20, MOCHA 60 - 2 × 12.5.
    $this->get(route('sales.report', ['period' => 'monthly', 'date' => '2026-11-01']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.summary.grossProfit', 185)
            ->where('report.summary.costCoverage', 100));
});

it('validates an imported cost sheet', function (array $input, string $field) {
    $this->post(route('sales.costs.import'), [
        'effective_from' => '2026-11-01',
        'costs' => [['article_code' => 'LATTE', 'unit_cost' => '20']],
        ...$input,
    ])->assertSessionHasErrors($field);
})->with([
    'no costs' => [['costs' => []], 'costs'],
    'bad cost' => [['costs' => [['article_code' => 'LATTE', 'unit_cost' => '1,000']]], 'costs.0.unit_cost'],
    'repeated item' => [['costs' => [['article_code' => 'LATTE', 'unit_cost' => '1'], ['article_code' => 'LATTE', 'unit_cost' => '2']]], 'costs.1.article_code'],
    'no date' => [['effective_from' => ''], 'effective_from'],
]);
