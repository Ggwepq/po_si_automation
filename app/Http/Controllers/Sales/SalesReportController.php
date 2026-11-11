<?php

namespace App\Http\Controllers\Sales;

use App\Domains\Sales\Actions\BuildSalesReport;
use App\Domains\Sales\Actions\GetSalesReportFilters;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\SalesReportRequest;
use Inertia\Inertia;
use Inertia\Response;

class SalesReportController extends Controller
{
    public function show(SalesReportRequest $request, BuildSalesReport $report, GetSalesReportFilters $filters): Response
    {
        $period = $request->period($filters->latestDate());
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
            'selected' => ['company' => $request->company(), 'site' => $request->siteCode()],
            'filters' => $filters->handle(),
            'report' => $report->handle($period, $request->company(), $request->siteCode()),
            'generatedAt' => now()->toIso8601String(),
        ]);
    }
}
