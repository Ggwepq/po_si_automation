<?php

namespace App\Http\Controllers\Sales;

use App\Domains\Sales\Actions\ImportDsrReports;
use App\Domains\Sales\Actions\ImportDsrSummaries;
use App\Domains\Sales\Models\DsrImport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\ImportDsrRequest;
use App\Http\Requests\Sales\ImportDsrSummaryRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DsrImportController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('sales/import', [
            'imports' => DsrImport::query()
                ->with('user:id,name')
                ->latest()
                ->limit(20)
                ->get()
                ->map(fn (DsrImport $import) => [
                    'id' => $import->id,
                    'fileName' => $import->file_name,
                    'kind' => $import->kind->value,
                    'reportCount' => $import->report_count,
                    'lineCount' => $import->line_count,
                    'replacedCount' => $import->replaced_count,
                    'firstDate' => $import->first_date?->toDateString(),
                    'lastDate' => $import->last_date?->toDateString(),
                    'importedBy' => $import->user?->name,
                    'importedAt' => $import->created_at?->toIso8601String(),
                ]),
            'limits' => [
                'reportsPerBatch' => ImportDsrRequest::MAX_REPORTS,
                'linesPerReport' => ImportDsrRequest::MAX_LINES,
                'summariesPerBatch' => ImportDsrSummaryRequest::MAX_SUMMARIES,
            ],
        ]);
    }

    public function store(ImportDsrRequest $request, ImportDsrReports $import): RedirectResponse
    {
        $result = $import->handle($request->reports(), $request->string('file_name')->toString(), $request->user());

        Inertia::flash('importResult', [
            'reportCount' => $result->report_count,
            'lineCount' => $result->line_count,
            'replacedCount' => $result->replaced_count,
        ]);

        return back();
    }

    public function storeSummary(ImportDsrSummaryRequest $request, ImportDsrSummaries $import): RedirectResponse
    {
        $result = $import->handle($request->summaries(), $request->string('file_name')->toString(), $request->user());

        Inertia::flash('importResult', [
            'reportCount' => $result->report_count,
            'lineCount' => 0,
            'replacedCount' => $result->replaced_count,
        ]);

        return back();
    }
}
