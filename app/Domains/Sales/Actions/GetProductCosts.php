<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\ProductCost;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Every item a company sells, with its cost history, the cost in effect
 * today, SM's latest price per unit from the DSRs and the resulting margin.
 */
class GetProductCosts
{
    /** Recent DSR days used for the item's current SM price. */
    private const PRICE_DAYS = 60;

    /** @return list<array<string, mixed>> */
    public function handle(int $companyId): array
    {
        $costs = ProductCost::query()
            ->where('company_id', $companyId)
            ->with('user:id,name')
            ->orderByDesc('effective_from')
            ->get()
            ->groupBy('article_id');

        $soldIds = DsrLine::query()->where('company_id', $companyId)->distinct()->pluck('article_id');
        $articles = Article::whereIn('id', $soldIds->merge($costs->keys())->unique())
            ->get(['id', 'code', 'description', 'uom'])
            ->sortBy('code', SORT_NATURAL)
            ->values();
        $prices = $this->latestPrices($companyId);
        $recent = $this->recentSales($companyId);
        $today = CarbonImmutable::today();

        return array_values($articles->map(function (Article $article) use ($costs, $prices, $recent, $today) {
            /** @var Collection<int, ProductCost> $history */
            $history = $costs->get($article->id, collect());
            $current = $history->first(fn (ProductCost $c) => $c->effective_from->lessThanOrEqualTo($today));
            $price = $prices[$article->id] ?? null;
            $cost = $current ? (float) $current->unit_cost : null;

            return [
                'code' => $article->code,
                'description' => $article->description,
                'uom' => $article->uom,
                'currentCost' => $cost,
                'smPrice' => $price,
                'margin' => $cost !== null && $price ? round(($price - $cost) / $price * 100, 2) : null,
                'recentSales' => $recent[$article->id] ?? 0.0,
                'history' => $history->map(fn (ProductCost $c) => [
                    'id' => $c->id,
                    'unitCost' => (float) $c->unit_cost,
                    'effectiveFrom' => $c->effective_from->toDateString(),
                    'setBy' => $c->user?->name,
                    'upcoming' => $c->effective_from->greaterThan($today),
                ])->values()->all(),
            ];
        })->all());
    }

    /**
     * Each item's sales over the last PRICE_DAYS of imported DSRs, so the page
     * can show how much of the business the entered costs cover.
     *
     * @return array<int, float> sales by article id
     */
    private function recentSales(int $companyId): array
    {
        $last = DsrLine::where('company_id', $companyId)->max('transaction_date');

        if ($last === null) {
            return [];
        }

        return DsrLine::query()
            ->where('company_id', $companyId)
            ->where('transaction_date', '>', CarbonImmutable::parse($last)->subDays(self::PRICE_DAYS)->toDateString())
            ->toBase()
            ->selectRaw('article_id, SUM(total_sales) AS sales')
            ->groupBy('article_id')
            ->pluck('sales', 'article_id')
            ->map(fn ($sales) => round((float) $sales, 2))
            ->all();
    }

    /**
     * Sales per unit on each item's latest DSR day: what SM currently pays.
     *
     * @return array<int, float> price by article id
     */
    private function latestPrices(int $companyId): array
    {
        $last = DsrLine::where('company_id', $companyId)->max('transaction_date');

        if ($last === null) {
            return [];
        }

        return DsrLine::query()
            ->where('company_id', $companyId)
            ->where('transaction_date', '>=', CarbonImmutable::parse($last)->subDays(self::PRICE_DAYS)->toDateString())
            ->toBase()
            ->selectRaw('article_id, transaction_date, SUM(total_sales) AS sales, SUM(sales_qty) AS qty')
            ->groupBy('article_id', 'transaction_date')
            ->orderBy('transaction_date')
            ->get()
            ->filter(fn ($row) => (float) $row->qty > 0)
            ->mapWithKeys(fn ($row) => [(int) $row->article_id => round((float) $row->sales / (float) $row->qty, 2)])
            ->all();
    }
}
