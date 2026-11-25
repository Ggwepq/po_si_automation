<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\ProductCost;
use App\Domains\Sales\Support\SalesReportCache;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Sets many items' costs from one date, e.g. from a vendor's cost sheet.
 * Items never seen in a DSR are skipped and returned, since there is no
 * sale yet to attach them to.
 */
class ImportProductCosts
{
    public function __construct(private SalesReportCache $cache) {}

    /**
     * @param  array<string, numeric-string>  $costs  unit cost by article code
     * @return array{saved: int, unknown: list<string>}
     */
    public function handle(Company $company, array $costs, CarbonImmutable $from, ?User $user): array
    {
        $ids = Article::whereIn('code', array_map('strval', array_keys($costs)))->pluck('id', 'code');
        $now = now();
        $rows = [];

        foreach ($costs as $code => $cost) {
            $id = $ids->get((string) $code);

            if ($id !== null) {
                $rows[] = [
                    'company_id' => $company->id,
                    'article_id' => $id,
                    'unit_cost' => $cost,
                    'effective_from' => $from->toDateString(),
                    'user_id' => $user?->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        if ($rows !== []) {
            ProductCost::query()->upsert($rows, ['company_id', 'article_id', 'effective_from'], ['unit_cost', 'user_id', 'updated_at']);
            $this->cache->flush();
        }

        return [
            'saved' => count($rows),
            'unknown' => array_values(array_diff(array_map('strval', array_keys($costs)), $ids->keys()->map(fn ($c) => (string) $c)->all())),
        ];
    }
}
