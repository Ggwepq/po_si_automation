<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\ProductCost;
use App\Domains\Sales\Support\SalesReportCache;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Sets an item's unit cost from a date onwards. Setting a cost again for the
 * same date corrects it instead of adding a second one. Reports are rebuilt,
 * since past gross profit may change.
 */
class SetProductCost
{
    public function __construct(private SalesReportCache $cache) {}

    /** @param numeric-string $unitCost */
    public function handle(Company $company, Article $article, string $unitCost, CarbonImmutable $from, ?User $user): void
    {
        $now = now();

        // Query builder: effective_from must be a plain Y-m-d to compare with transaction dates.
        ProductCost::query()->upsert([[
            'company_id' => $company->id,
            'article_id' => $article->id,
            'unit_cost' => $unitCost,
            'effective_from' => $from->toDateString(),
            'user_id' => $user?->id,
            'created_at' => $now,
            'updated_at' => $now,
        ]], ['company_id', 'article_id', 'effective_from'], ['unit_cost', 'user_id', 'updated_at']);

        $this->cache->flush();
    }
}
