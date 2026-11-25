<?php

namespace App\Http\Controllers\Sales;

use App\Domains\Sales\Actions\BuildModconSummary;
use App\Domains\Sales\Actions\BuildSalesMatrix;
use App\Domains\Sales\Actions\BuildSalesReport;
use App\Domains\Sales\Actions\CheckDsrCoverage;
use App\Domains\Sales\Actions\GetSalesReportFilters;
use App\Domains\Sales\Actions\ReconcileDsr;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\SalesReportRequest;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

class SalesReportController extends Controller
{
    public function show(
        SalesReportRequest $request,
        BuildSalesReport $report,
        CheckDsrCoverage $coverage,
        GetSalesReportFilters $filters,
        ReconcileDsr $reconcile,
    ): Response {
        $filter = $request->filter();
        $period = $request->period($filters->latestDate($filter->companyId));
        $previous = $period->previous();
        $next = $period->next();

        return Inertia::render('sales/report', [
            'period' => [
                'type' => $period->type->value,
                'start' => $period->start->toDateString(),
                'end' => $period->end->toDateString(),
                'label' => $period->label(),
                'days' => $period->days(),
                'previous' => ['start' => $previous->start->toDateString(), 'end' => $previous->end->toDateString(), 'label' => $previous->label()],
                'next' => ['start' => $next->start->toDateString(), 'end' => $next->end->toDateString(), 'label' => $next->label()],
            ],
            'selected' => [
                'vendors' => $filter->vendorCodes,
                'companies' => $filter->companies,
                'sites' => $filter->siteCodes,
            ],
            'filters' => $filters->handle($filter->companyId),
            'report' => $report->handle($period, $filter),
            'coverage' => $coverage->handle($period, $filter),
            'reconciliation' => $reconcile->handle($period, $filter),
            'generatedAt' => now()->toIso8601String(),
        ]);
    }

    /**
     * Item grids by day and by store for the Excel export. Fetched only when
     * the user downloads, so the report page stays light.
     */
    public function matrix(SalesReportRequest $request, BuildSalesMatrix $matrix, GetSalesReportFilters $filters): JsonResponse
    {
        $filter = $request->filter();

        return response()->json($matrix->handle($request->period($filters->latestDate($filter->companyId)), $filter));
    }

    /** The ModCon summary for the year of the report's period, for its Excel export. */
    public function modcon(SalesReportRequest $request, BuildModconSummary $modcon, GetSalesReportFilters $filters): JsonResponse
    {
        $filter = $request->filter();
        $period = $request->period($filters->latestDate($filter->companyId));

        return response()->json($modcon->handle($period->start->year, $filter));
    }
}
