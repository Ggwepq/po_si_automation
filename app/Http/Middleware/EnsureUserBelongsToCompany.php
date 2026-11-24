<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Company pages (dashboard, sales, workbook tools) show one company's data,
 * so they need a user who belongs to a company. Super admins are sent to
 * the admin area instead; anyone else without a company is refused, so a
 * missing company can never fall through to unscoped data.
 */
class EnsureUserBelongsToCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->isSuperAdmin() && $request->isMethod('GET')) {
            return redirect()->route('admin.companies.index');
        }

        abort_unless($user instanceof User && ! $user->isSuperAdmin() && $user->company_id !== null, 403);

        return $next($request);
    }
}
