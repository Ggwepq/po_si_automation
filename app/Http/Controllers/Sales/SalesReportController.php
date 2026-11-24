<?php

namespace App\Http\Controllers\Sales;

use App\Domains\Sales\Actions\BuildSalesReport;
use App\Domains\Sales\Actions\CheckDsrCoverage;
use App\Domains\Sales\Actions\GetSalesReportFilters;
use App\Domains\Sales\Actions\ReconcileDsr;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\SalesReportRequest;
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
}
