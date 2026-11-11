<?php

namespace App\Domains\Sales\Support;

use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Models\Vendor;

/**
 * Saves the vendors and stores named in an import (new ones are added, names
 * are updated) and returns their ids by code. Shared by the DSR and DSR
 * Summary imports.
 */
class StoreDirectory
{
    /**
     * @param  iterable<array{code: string, name: string}>  $vendors
     * @return array<string, int> vendor id by code
     */
    public function vendorIds(iterable $vendors): array
    {
        $rows = collect($vendors)->keyBy('code')->values()->all();

        if ($rows === []) {
            return [];
        }

        Vendor::upsert($rows, ['code'], ['name']);

        /** @var array<string, int> */
        return Vendor::whereIn('code', array_column($rows, 'code'))->pluck('id', 'code')->all();
    }

    /**
     * @param  iterable<array{code: string, name: string, company: string}>  $sites
     * @return array<string, int> site id by code
     */
    public function siteIds(iterable $sites): array
    {
        $rows = collect($sites)->keyBy('code')->values()->all();

        if ($rows === []) {
            return [];
        }

        Site::upsert($rows, ['code'], ['name', 'company']);

        /** @var array<string, int> */
        return Site::whereIn('code', array_column($rows, 'code'))->pluck('id', 'code')->all();
    }
}
