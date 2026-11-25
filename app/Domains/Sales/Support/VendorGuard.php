<?php

namespace App\Domains\Sales\Support;

use App\Domains\Companies\Models\Company;
use Illuminate\Validation\ValidationException;

/**
 * Stops a company importing another vendor's DSRs (e.g. HnF's file into
 * Oroza Enterprise), which would mix two businesses' sales.
 */
final class VendorGuard
{
    /** @param iterable<string> $vendorCodes */
    public static function check(Company $company, iterable $vendorCodes, string $field): void
    {
        $others = collect($vendorCodes)
            ->unique()
            ->reject(fn (string $code) => $company->ownsVendor($code))
            ->values();

        if ($others->isNotEmpty()) {
            throw ValidationException::withMessages([
                $field => "This file is for vendor {$others->implode(', ')}, but {$company->name}'s account number is {$company->account_number}. Import only your own company's DSRs.",
            ]);
        }
    }
}
