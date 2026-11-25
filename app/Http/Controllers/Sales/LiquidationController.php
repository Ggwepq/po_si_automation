<?php

namespace App\Http\Controllers\Sales;

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Actions\BuildLiquidationReport;
use App\Domains\Sales\Actions\CompareLiquidationItems;
use App\Domains\Sales\Models\Liquidation;
use App\Domains\Sales\Models\LiquidationPayment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\StoreLiquidationPaymentRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** SM's half-month liquidations, checked against the DSRs, with the payments received. */
class LiquidationController extends Controller
{
    public function index(Request $request, BuildLiquidationReport $report): Response
    {
        return Inertia::render('sales/liquidation', [
            'liquidations' => $report->handle($this->company($request)->id),
            'company' => $this->company($request)->name,
            'today' => now()->toDateString(),
        ]);
    }

    public function items(Request $request, Liquidation $liquidation, CompareLiquidationItems $compare): JsonResponse
    {
        $this->authorizeCompany($request, $liquidation);

        return response()->json(['stores' => $compare->handle($liquidation)]);
    }

    public function storePayment(StoreLiquidationPaymentRequest $request, Liquidation $liquidation): RedirectResponse
    {
        $this->authorizeCompany($request, $liquidation);

        // Query builder keeps paid_on a plain Y-m-d.
        LiquidationPayment::query()->insert([
            'liquidation_id' => $liquidation->id,
            'paid_on' => $request->string('paid_on')->toString(),
            'reference' => $request->filled('reference') ? $request->string('reference')->trim()->toString() : null,
            'amount' => $request->string('amount')->toString(),
            'user_id' => $request->user()?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Payment recorded for {$liquidation->chain}, {$liquidation->period_start->format('M j')}–{$liquidation->period_end->format('M j, Y')}."]);

        return back();
    }

    public function destroyPayment(Request $request, LiquidationPayment $payment): RedirectResponse
    {
        $this->authorizeCompany($request, $payment->liquidation);

        $payment->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Payment removed.']);

        return back();
    }

    /** Another company's liquidation is reported as missing, not forbidden. */
    private function authorizeCompany(Request $request, Liquidation $liquidation): void
    {
        abort_unless($liquidation->company_id === $this->company($request)->id, 404);
    }

    /** The 'company' middleware guarantees the user has one. */
    private function company(Request $request): Company
    {
        $company = $request->user()?->company;

        abort_unless($company instanceof Company, 403);

        return $company;
    }
}
