<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Data\DsrSummaryData;
use App\Domains\Sales\Enums\ImportKind;
use App\Domains\Sales\Models\DsrImport;
use App\Domains\Sales\Models\DsrSummary;
use App\Domains\Sales\Support\SalesReportCache;
use App\Domains\Sales\Support\StoreDirectory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves a company's copy of SM's DSR Summary (official daily totals per
 * store). Idempotent: re-importing a store-day replaces SM's figure. Summaries are only used to
 * check the DSR lines; they never count as sales themselves.
 */
class ImportDsrSummaries
{
    private const UPSERT_CHUNK = 500;

    public function __construct(
        private SalesReportCache $cache,
        private StoreDirectory $stores,
    ) {}

    /** @param list<DsrSummaryData> $summaries */
    public function handle(Company $company, array $summaries, string $fileName, ?User $user): DsrImport
    {
        $this->rejectDuplicates($summaries);

        $import = DB::transaction(function () use ($company, $summaries, $fileName, $user): DsrImport {
            $vendorIds = $this->stores->vendorIds(array_map(
                fn (DsrSummaryData $s) => ['code' => $s->vendorCode, 'name' => $s->vendorName],
                $summaries,
            ));
            $siteIds = $this->stores->siteIds(array_map(
                fn (DsrSummaryData $s) => ['code' => $s->siteCode, 'name' => $s->siteName, 'company' => $s->company],
                $summaries,
            ));

            $import = DsrImport::create([
                'company_id' => $company->id,
                'user_id' => $user?->id,
                'file_name' => $fileName,
                'kind' => ImportKind::Summary,
                'report_count' => count($summaries),
                'line_count' => 0,
                'replaced_count' => $this->countExisting($company, $summaries, $vendorIds, $siteIds),
                'first_date' => collect($summaries)->min(fn (DsrSummaryData $s) => $s->transactionDate),
                'last_date' => collect($summaries)->max(fn (DsrSummaryData $s) => $s->transactionDate),
            ]);

            $now = now();
            $rows = array_map(fn (DsrSummaryData $s) => [
                'company_id' => $company->id,
                'vendor_id' => $vendorIds[$s->vendorCode],
                'site_id' => $siteIds[$s->siteCode],
                // Plain Y-m-d so the unique index matches on every database.
                'transaction_date' => $s->transactionDate->toDateString(),
                'total_sales' => $s->totalSales,
                'dsr_import_id' => $import->id,
                'created_at' => $now,
                'updated_at' => $now,
            ], $summaries);

            foreach (array_chunk($rows, self::UPSERT_CHUNK) as $chunk) {
                DsrSummary::upsert(
                    $chunk,
                    ['company_id', 'vendor_id', 'site_id', 'transaction_date'],
                    ['total_sales', 'dsr_import_id', 'updated_at'],
                );
            }

            return $import;
        });

        $this->cache->flush();

        return $import;
    }

    /** @param list<DsrSummaryData> $summaries */
    private function rejectDuplicates(array $summaries): void
    {
        $duplicates = collect($summaries)
            ->countBy(fn (DsrSummaryData $s) => $s->key())
            ->filter(fn (int $count) => $count > 1)
            ->keys();

        if ($duplicates->isNotEmpty()) {
            throw ValidationException::withMessages([
                'summaries' => 'The file contains the same store and date more than once: '.$duplicates->implode(', ').'.',
            ]);
        }
    }

    /**
     * @param  list<DsrSummaryData>  $summaries
     * @param  array<string, int>  $vendorIds
     * @param  array<string, int>  $siteIds
     */
    private function countExisting(Company $company, array $summaries, array $vendorIds, array $siteIds): int
    {
        $dates = collect($summaries)->map(fn (DsrSummaryData $s) => $s->transactionDate->toDateString());

        $existing = DsrSummary::query()
            ->where('company_id', $company->id)
            ->whereIn('vendor_id', array_values($vendorIds))
            ->whereIn('site_id', array_values($siteIds))
            ->whereBetween('transaction_date', [$dates->min(), $dates->max()])
            ->get(['vendor_id', 'site_id', 'transaction_date'])
            ->map(fn (DsrSummary $s) => $s->vendor_id.'|'.$s->site_id.'|'.$s->transaction_date->toDateString())
            ->flip();

        return collect($summaries)
            ->filter(fn (DsrSummaryData $s) => $existing->has(
                $vendorIds[$s->vendorCode].'|'.$siteIds[$s->siteCode].'|'.$s->transactionDate->toDateString(),
            ))
            ->count();
    }
}
