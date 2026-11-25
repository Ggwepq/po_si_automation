<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Data\CsrStoreData;
use App\Domains\Sales\Data\DsrLineData;
use App\Domains\Sales\Enums\ImportKind;
use App\Domains\Sales\Models\CsrLine;
use App\Domains\Sales\Models\DsrImport;
use App\Domains\Sales\Support\StoreDirectory;
use App\Domains\Sales\Support\VendorGuard;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves SM's Consolidated Sales Report: its sales per store and item for a
 * half-month. Re-importing a store's period replaces it. Used only to check
 * the DSRs, never counted as sales.
 */
class ImportCsr
{
    private const INSERT_CHUNK = 500;

    public function __construct(private StoreDirectory $stores) {}

    /** @param list<CsrStoreData> $stores */
    public function handle(Company $company, array $stores, string $fileName, ?User $user): DsrImport
    {
        $duplicates = collect($stores)->countBy(fn (CsrStoreData $s) => $s->key())->filter(fn (int $n) => $n > 1)->keys();

        if ($duplicates->isNotEmpty()) {
            throw ValidationException::withMessages(['stores' => 'The file has the same store and period more than once: '.$duplicates->implode(', ').'.']);
        }

        VendorGuard::check($company, array_map(fn (CsrStoreData $s) => $s->vendorCode, $stores), 'stores');

        return DB::transaction(function () use ($company, $stores, $fileName, $user): DsrImport {
            $vendorIds = $this->stores->vendorIds(array_map(fn (CsrStoreData $s) => ['code' => $s->vendorCode, 'name' => $s->vendorName], $stores));
            $siteIds = $this->stores->siteIds(array_map(fn (CsrStoreData $s) => ['code' => $s->siteCode, 'name' => $s->siteName, 'company' => $s->company], $stores), updateNames: false);
            $articleIds = $this->stores->articleIds(collect($stores)->flatMap(fn (CsrStoreData $s) => $s->lines), updateNames: false);

            $import = DsrImport::create([
                'company_id' => $company->id,
                'user_id' => $user?->id,
                'file_name' => $fileName,
                'kind' => ImportKind::Csr,
                'report_count' => count($stores),
                'line_count' => array_sum(array_map(fn (CsrStoreData $s) => count($s->lines), $stores)),
                'replaced_count' => 0,
                'first_date' => collect($stores)->min(fn (CsrStoreData $s) => $s->periodStart),
                'last_date' => collect($stores)->max(fn (CsrStoreData $s) => $s->periodEnd),
            ]);

            $replaced = 0;
            $rows = [];
            $now = now();

            foreach ($stores as $store) {
                $replaced += CsrLine::query()->where([
                    'company_id' => $company->id,
                    'vendor_id' => $vendorIds[$store->vendorCode],
                    'site_id' => $siteIds[$store->siteCode],
                    'period_start' => $store->periodStart->toDateString(),
                    'period_end' => $store->periodEnd->toDateString(),
                ])->delete() > 0 ? 1 : 0;

                // The CSR lists an item once per store; a repeat is merged.
                $lines = collect($store->lines)->groupBy(fn (DsrLineData $l) => $l->articleCode);

                foreach ($lines as $code => $same) {
                    $rows[] = [
                        'company_id' => $company->id,
                        'vendor_id' => $vendorIds[$store->vendorCode],
                        'site_id' => $siteIds[$store->siteCode],
                        'article_id' => $articleIds[(string) $code],
                        // Plain Y-m-d so date comparisons work on every database.
                        'period_start' => $store->periodStart->toDateString(),
                        'period_end' => $store->periodEnd->toDateString(),
                        'sales_qty' => $this->sum($same, fn (DsrLineData $l) => $l->salesQty, 3),
                        'vat_exempt_sales' => $this->sum($same, fn (DsrLineData $l) => $l->vatExemptSales, 2),
                        'vatable_sales' => $this->sum($same, fn (DsrLineData $l) => $l->vatableSales, 2),
                        'total_sales' => $this->sum($same, fn (DsrLineData $l) => $l->totalSales, 2),
                        'dsr_import_id' => $import->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            foreach (array_chunk($rows, self::INSERT_CHUNK) as $chunk) {
                CsrLine::insert($chunk);
            }

            $import->update(['replaced_count' => $replaced]);

            return $import;
        });
    }

    /**
     * @param  iterable<DsrLineData>  $lines
     * @param  callable(DsrLineData): numeric-string  $value
     */
    private function sum(iterable $lines, callable $value, int $scale): string
    {
        $total = '0';

        foreach ($lines as $line) {
            $total = bcadd($total, $value($line), $scale);
        }

        return $total;
    }
}
