<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Data\DsrLineData;
use App\Domains\Sales\Data\DsrReportData;
use App\Domains\Sales\Models\DsrImport;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\DsrReport;
use App\Domains\Sales\Support\SalesReportCache;
use App\Domains\Sales\Support\StoreDirectory;
use App\Domains\Sales\Support\VendorGuard;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves a company's DSR documents. Idempotent: each store-day is stored once per company, and
 * importing it again (e.g. a revised DSR from SM) replaces its lines instead of
 * adding to them. Everything runs in one transaction, so a failed import
 * leaves no partial data.
 */
class ImportDsrReports
{
    private const INSERT_CHUNK = 500;

    public function __construct(
        private SalesReportCache $cache,
        private StoreDirectory $stores,
    ) {}

    /** @param list<DsrReportData> $reports */
    public function handle(Company $company, array $reports, string $fileName, ?User $user): DsrImport
    {
        $this->rejectDuplicates($reports);
        VendorGuard::check($company, array_map(fn (DsrReportData $r) => $r->vendorCode, $reports), 'reports');

        $import = DB::transaction(function () use ($company, $reports, $fileName, $user): DsrImport {
            $vendorIds = $this->stores->vendorIds(array_map(
                fn (DsrReportData $r) => ['code' => $r->vendorCode, 'name' => $r->vendorName],
                $reports,
            ));
            $siteIds = $this->stores->siteIds(array_map(
                fn (DsrReportData $r) => ['code' => $r->siteCode, 'name' => $r->siteName, 'company' => $r->company],
                $reports,
            ));
            $articleIds = $this->stores->articleIds(collect($reports)->flatMap(fn (DsrReportData $r) => $r->lines));

            $import = DsrImport::create([
                'company_id' => $company->id,
                'user_id' => $user?->id,
                'file_name' => $fileName,
                'report_count' => count($reports),
                'line_count' => array_sum(array_map(fn (DsrReportData $r) => count($r->lines), $reports)),
                'replaced_count' => 0,
                'first_date' => collect($reports)->min(fn (DsrReportData $r) => $r->transactionDate),
                'last_date' => collect($reports)->max(fn (DsrReportData $r) => $r->transactionDate),
            ]);

            $replaced = 0;

            foreach ($reports as $report) {
                $replaced += $this->saveReport(
                    $report,
                    $vendorIds[$report->vendorCode],
                    $siteIds[$report->siteCode],
                    $articleIds,
                    $import,
                ) ? 1 : 0;
            }

            $import->update(['replaced_count' => $replaced]);

            return $import;
        });

        $this->cache->flush();

        return $import;
    }

    /** @param list<DsrReportData> $reports */
    private function rejectDuplicates(array $reports): void
    {
        $duplicates = collect($reports)
            ->countBy(fn (DsrReportData $report) => $report->key())
            ->filter(fn (int $count) => $count > 1)
            ->keys();

        if ($duplicates->isNotEmpty()) {
            throw ValidationException::withMessages([
                'reports' => 'The file contains the same store and date more than once: '.$duplicates->implode(', ').'.',
            ]);
        }
    }

    /**
     * @param  array<string, int>  $articleIds
     * @return bool whether an earlier import of this store-day was replaced
     */
    private function saveReport(DsrReportData $report, int $vendorId, int $siteId, array $articleIds, DsrImport $import): bool
    {
        $lines = collect($report->lines);
        $existing = DsrReport::where('company_id', $import->company_id)
            ->where('vendor_id', $vendorId)
            ->where('site_id', $siteId)
            ->whereDate('transaction_date', $report->transactionDate)
            ->first();

        $existing?->lines()->delete();

        $attributes = [
            'data_status' => $report->dataStatus,
            'article_count' => $lines->unique(fn (DsrLineData $l) => $l->articleCode)->count(),
            'total_qty' => $this->sum($lines, fn (DsrLineData $l) => $l->salesQty, 3),
            'total_sales' => $this->sum($lines, fn (DsrLineData $l) => $l->totalSales, 2),
            'dsr_import_id' => $import->id,
        ];

        $saved = $existing
            ? tap($existing)->update($attributes)
            : DsrReport::create([
                ...$attributes,
                'company_id' => $import->company_id,
                'vendor_id' => $vendorId,
                'site_id' => $siteId,
                'transaction_date' => $report->transactionDate,
            ]);

        $date = $report->transactionDate->toDateString();

        foreach ($lines->chunk(self::INSERT_CHUNK) as $chunk) {
            DsrLine::insert($chunk->map(fn (DsrLineData $line) => [
                'dsr_report_id' => $saved->id,
                'company_id' => $import->company_id,
                'vendor_id' => $vendorId,
                'site_id' => $siteId,
                'article_id' => $articleIds[$line->articleCode],
                'transaction_date' => $date,
                'sales_qty' => $line->salesQty,
                'vat_exempt_sales' => $line->vatExemptSales,
                'vatable_sales' => $line->vatableSales,
                'total_sales' => $line->totalSales,
            ])->values()->all());
        }

        return $existing !== null;
    }

    /**
     * Adds decimal strings exactly (no floating-point drift on money).
     *
     * @param  Collection<int, DsrLineData>  $lines
     * @param  callable(DsrLineData): numeric-string  $value
     * @return numeric-string
     */
    private function sum(Collection $lines, callable $value, int $scale): string
    {
        $total = '0';

        foreach ($lines as $line) {
            $total = bcadd($total, $value($line), $scale);
        }

        return $total;
    }
}
