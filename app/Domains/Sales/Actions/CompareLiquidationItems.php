<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\CsrLine;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\Liquidation;
use Illuminate\Support\Collection;

/**
 * Item by item, for each store in a liquidation: SM's Consolidated Sales
 * Report against the imported DSR lines for the same days. Shows exactly
 * which item (and so which day's file) explains a difference.
 */
class CompareLiquidationItems
{
    /** @return list<array<string, mixed>> */
    public function handle(Liquidation $liquidation): array
    {
        $liquidation->loadMissing('stores.site:id,code,name');
        $siteIds = $liquidation->stores->pluck('site_id')->all();
        $scope = [
            'company_id' => $liquidation->company_id,
            'vendor_id' => $liquidation->vendor_id,
        ];

        $dsr = DsrLine::query()
            ->where($scope)
            ->whereIn('site_id', $siteIds)
            ->whereBetween('transaction_date', [$liquidation->period_start->toDateString(), $liquidation->period_end->toDateString()])
            ->toBase()
            ->selectRaw('site_id, article_id, SUM(sales_qty) AS qty, SUM(total_sales) AS sales')
            ->groupBy('site_id', 'article_id')
            ->get()
            ->keyBy(fn ($row) => "{$row->site_id}|{$row->article_id}");

        $csr = CsrLine::query()
            ->where($scope)
            ->whereIn('site_id', $siteIds)
            ->where('period_start', $liquidation->period_start->toDateString())
            ->where('period_end', $liquidation->period_end->toDateString())
            ->toBase()
            ->get(['site_id', 'article_id', 'sales_qty AS qty', 'total_sales AS sales'])
            ->keyBy(fn ($row) => "{$row->site_id}|{$row->article_id}");

        $articles = Article::whereIn('id', $dsr->pluck('article_id')->merge($csr->pluck('article_id'))->unique())
            ->get(['id', 'code', 'description'])
            ->keyBy('id');

        return array_values($liquidation->stores->sortBy(fn ($s) => $s->site->code)->map(function ($store) use ($dsr, $csr, $articles) {
            /** @var Collection<int, int> $ids */
            $ids = $dsr->merge($csr)->filter(fn ($row) => (int) $row->site_id === $store->site_id)->pluck('article_id')->unique();

            $items = $ids->map(function ($articleId) use ($store, $dsr, $csr, $articles) {
                $d = $dsr->get("{$store->site_id}|{$articleId}");
                $c = $csr->get("{$store->site_id}|{$articleId}");
                $article = $articles->get($articleId);

                return [
                    'code' => $article->code,
                    'description' => $article->description,
                    'csrQty' => $c ? (float) $c->qty : null,
                    'csrSales' => $c ? round((float) $c->sales, 2) : null,
                    'dsrQty' => $d ? (float) $d->qty : 0.0,
                    'dsrSales' => $d ? round((float) $d->sales, 2) : 0.0,
                ];
            })->sortBy('code', SORT_NATURAL)->values()->all();

            return [
                'code' => $store->site->code,
                'name' => $store->site->name,
                'items' => $items,
            ];
        })->all());
    }
}
