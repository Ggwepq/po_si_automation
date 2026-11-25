<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The PO & SI workflow and RA item matching are only for companies that
 * have them turned on (Oroza Enterprise). Runs after 'company', so the
 * user already belongs to one.
 */
class EnsureCompanyHasWorkbookTools
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        abort_unless($user instanceof User && $user->company?->workbook_tools === true, 403);

        return $next($request);
    }
}
