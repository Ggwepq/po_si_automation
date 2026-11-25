<?php

namespace App\Http\Controllers\Sales;

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Actions\GetProductCosts;
use App\Domains\Sales\Actions\ImportProductCosts;
use App\Domains\Sales\Actions\SetProductCost;
use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\ProductCost;
use App\Domains\Sales\Support\SalesReportCache;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\ImportProductCostsRequest;
use App\Http\Requests\Sales\StoreProductCostRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductCostController extends Controller
{
    public function index(Request $request, GetProductCosts $costs): Response
    {
        return Inertia::render('sales/costs', [
            'products' => $costs->handle($this->company($request)->id),
            'today' => now()->toDateString(),
        ]);
    }

    public function store(StoreProductCostRequest $request, SetProductCost $setCost): RedirectResponse
    {
        $article = Article::where('code', $request->string('article_code')->toString())->firstOrFail();

        $setCost->handle($this->company($request), $article, $request->unitCost(), $request->effectiveFrom(), $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Cost saved for {$article->description}."]);

        return back();
    }

    /** Costs read from a cost sheet in the browser, all from one date. */
    public function import(ImportProductCostsRequest $request, ImportProductCosts $import): RedirectResponse
    {
        $result = $import->handle($this->company($request), $request->costs(), $request->effectiveFrom(), $request->user());
        $message = "Costs saved for {$result['saved']} item".($result['saved'] === 1 ? '' : 's').'.';

        if ($result['unknown'] !== []) {
            $message .= ' Skipped '.count($result['unknown']).' not in any DSR yet: '.implode(', ', array_slice($result['unknown'], 0, 10))
                .(count($result['unknown']) > 10 ? '…' : '.');
        }

        $type = match (true) {
            $result['saved'] === 0 => 'error',
            $result['unknown'] !== [] => 'warning',
            default => 'success',
        };

        Inertia::flash('toast', ['type' => $type, 'message' => $message]);

        return back();
    }

    public function destroy(Request $request, ProductCost $productCost, SalesReportCache $cache): RedirectResponse
    {
        // Another company's cost is reported as missing, not forbidden.
        abort_unless($productCost->company_id === $this->company($request)->id, 404);

        $productCost->delete();
        $cache->flush();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Cost removed.']);

        return back();
    }

    /** The 'company' middleware guarantees the user has one. */
    private function company(Request $request): Company
    {
        $company = $request->user()?->company;

        abort_unless($company instanceof Company, 403);

        return $company;
    }
}
