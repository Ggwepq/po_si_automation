<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Data\DsrLineData;
use App\Domains\Sales\Data\DsrReportData;
use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\DsrImport;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\DsrReport;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Models\Vendor;
use App\Domains\Sales\Support\SalesReportCache;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves DSR documents. Idempotent: each store-day is stored once, and
 * importing it again (e.g. a revised DSR from SM) replaces its lines instead of
 * adding to them. Everything runs in one transaction, so a failed import
 * leaves no partial data.
 */
class ImportDsrReports
{
    private const INSERT_CHUNK = 500;

    public function __construct(private SalesReportCache $cache) {}

    /** @param list<DsrReportData> $reports */
    public function handle(array $reports, string $fileName, ?User $user): DsrImport
    {
        $this->rejectDuplicates($reports);

        $import = DB::transaction(function () use ($reports, $fileName, $user): DsrImport {
            $vendorIds = $this->saveVendors($reports);
            $siteIds = $this->saveSites($reports);
            $articleIds = $this->saveArticles($reports);

            $import = DsrImport::create([
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
     * @param  list<DsrReportData>  $reports
     * @return array<string, int> vendor id by vendor code
     */
    private function saveVendors(array $reports): array
    {
        $rows = collect($reports)
            ->keyBy(fn (DsrReportData $r) => $r->vendorCode)
            ->map(fn (DsrReportData $r) => ['code' => $r->vendorCode, 'name' => $r->vendorName])
            ->values()
            ->all();

        Vendor::upsert($rows, ['code'], ['name']);

        /** @var array<string, int> */
        return Vendor::whereIn('code', array_column($rows, 'code'))->pluck('id', 'code')->all();
    }

    /**
     * @param  list<DsrReportData>  $reports
     * @return array<string, int> site id by site code
     */
    private function saveSites(array $reports): array
    {
        $rows = collect($reports)
            ->keyBy(fn (DsrReportData $r) => $r->siteCode)
            ->map(fn (DsrReportData $r) => ['code' => $r->siteCode, 'name' => $r->siteName, 'company' => $r->company])
            ->values()
            ->all();

        Site::upsert($rows, ['code'], ['name', 'company']);

        /** @var array<string, int> */
        return Site::whereIn('code', array_column($rows, 'code'))->pluck('id', 'code')->all();
    }

    /**
     * @param  list<DsrReportData>  $reports
     * @return array<string, int> article id by article code
     */
    private function saveArticles(array $reports): array
    {
        $rows = collect($reports)
            ->flatMap(fn (DsrReportData $r) => $r->lines)
            ->keyBy(fn (DsrLineData $l) => $l->articleCode)
            ->map(fn (DsrLineData $l) => [
                'code' => $l->articleCode,
                'description' => $l->description,
                'barcode' => $l->barcode,
                'uom' => $l->uom,
            ])
            ->values();

        $ids = [];

        foreach ($rows->chunk(self::INSERT_CHUNK) as $chunk) {
            Article::upsert($chunk->all(), ['code'], ['description', 'barcode', 'uom']);
            $ids += Article::whereIn('code', $chunk->pluck('code'))->pluck('id', 'code')->all();
        }

        /** @var array<string, int> $ids */
        return $ids;
    }

    /**
     * @param  array<string, int>  $articleIds
     * @return bool whether an earlier import of this store-day was replaced
     */
    private function saveReport(DsrReportData $report, int $vendorId, int $siteId, array $articleIds, DsrImport $import): bool
    {
        $lines = collect($report->lines);
        $existing = DsrReport::where('vendor_id', $vendorId)
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
                'vendor_id' => $vendorId,
                'site_id' => $siteId,
                'transaction_date' => $report->transactionDate,
            ]);

        $date = $report->transactionDate->toDateString();

        foreach ($lines->chunk(self::INSERT_CHUNK) as $chunk) {
            DsrLine::insert($chunk->map(fn (DsrLineData $line) => [
                'dsr_report_id' => $saved->id,
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
