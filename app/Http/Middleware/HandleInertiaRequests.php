<?php

namespace App\Http\Middleware;

use App\Domains\Sales\Models\DsrReport;
use App\Http\Requests\Sales\ImportClrRequest;
use App\Http\Requests\Sales\ImportCsrRequest;
use App\Http\Requests\Sales\ImportDsrRequest;
use App\Http\Requests\Sales\ImportDsrSummaryRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
                'isSuperAdmin' => $user instanceof User && $user->isSuperAdmin(),
                // Branding for the sidebar and reports; null for super admins.
                'company' => $user instanceof User ? $user->company?->toBrand() : null,
            ],
            // Company users only: the sidebar's "last DSR" date and the batch
            // sizes the import dialog (on any page) sends.
            'sales' => fn () => $user instanceof User && $user->company_id !== null ? [
                'lastDsrDate' => self::date(DsrReport::where('company_id', $user->company_id)->max('transaction_date')),
                'importLimits' => [
                    'reportsPerBatch' => ImportDsrRequest::MAX_REPORTS,
                    'linesPerReport' => ImportDsrRequest::MAX_LINES,
                    'summariesPerBatch' => ImportDsrSummaryRequest::MAX_SUMMARIES,
                    'csrStoresPerBatch' => ImportCsrRequest::MAX_STORES,
                    'liquidationsPerBatch' => ImportClrRequest::MAX_LIQUIDATIONS,
                ],
            ] : null,
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }

    /** Y-m-d; some databases return a date column's MAX() with a time. */
    private static function date(mixed $value): ?string
    {
        return is_string($value) ? substr($value, 0, 10) : null;
    }
}
