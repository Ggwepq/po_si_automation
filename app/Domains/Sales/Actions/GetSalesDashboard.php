<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Enums\PeriodType;
use App\Domains\Sales\Models\DsrImport;
use App\Domains\Sales\Models\DsrReport;

/**
 * The dashboard's sales overview: the month of the latest imported sales,
 * from its first day up to that latest day, with the data checks a manager
 * needs before trusting the numbers. Reuses the cached report actions, so it
 * costs no more than opening the sales report.
 */
class GetSalesDashboard
{
    private const TOP = 5;

    public function __construct(
        private BuildSalesReport $report,
        private CheckDsrCoverage $coverage,
        private ReconcileDsr $reconcile,
        private GetSalesReportFilters $filters,
    ) {}

    /** @return array<string, mixed> */
    public function handle(): array
    {
        $lastImport = $this->lastImport();

        if (! DsrReport::query()->exists()) {
            return ['hasData' => false, 'lastImport' => $lastImport];
        }

        $latest = $this->filters->latestDate();
        $monthToDate = ReportPeriod::containing(PeriodType::Custom, $latest->startOfMonth(), $latest);
        $month = ReportPeriod::containing(PeriodType::Monthly, $latest);
        $report = $this->report->handle($monthToDate);
        $coverage = $this->coverage->handle($month);
        $check = $this->reconcile->handle($month);
        /** @var list<array{date: string, sales: float}> $points */
        $points = $report['trend']['points'];
        $latestDay = collect($points)->firstWhere('date', $latest->toDateString());

        return [
            'hasData' => true,
            'period' => [
                'start' => $monthToDate->start->toDateString(),
                'end' => $monthToDate->end->toDateString(),
                'month' => $month->label(),
                'previousLabel' => $monthToDate->previous()->label(),
            ],
            'summary' => $report['summary'],
            'byCompany' => $report['byCompany'],
            'topStores' => array_slice($report['byStore'], 0, self::TOP),
            'topItems' => collect($report['items'])->sortByDesc('sales')->take(self::TOP)->values()->all(),
            'latestDay' => ['date' => $latest->toDateString(), 'sales' => $latestDay['sales'] ?? 0],
            'health' => [
                'daysChecked' => $coverage['daysChecked'] ?? 0,
                'daysWithoutAnyDsr' => count($coverage['daysWithoutAnyDsr']),
                'complete' => $coverage['complete'],
                'reconciled' => $check['checked'],
                'balanced' => $check['balanced'],
                'issues' => $check['counts']['differs'] + $check['counts']['not_imported'] + $check['counts']['not_in_summary'],
            ],
            'lastImport' => $lastImport,
        ];
    }

    /** @return array{fileName: string, kind: string, importedAt: string|null, importedBy: string|null}|null */
    private function lastImport(): ?array
    {
        $import = DsrImport::query()->with('user:id,name')->latest('id')->first();

        return $import ? [
            'fileName' => $import->file_name,
            'kind' => $import->kind->value,
            'importedAt' => $import->created_at?->toIso8601String(),
            'importedBy' => $import->user?->name,
        ] : null;
    }
}
