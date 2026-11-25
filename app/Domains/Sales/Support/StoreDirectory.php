<?php

namespace App\Domains\Sales\Support;

use App\Domains\Sales\Data\DsrLineData;
use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Models\Vendor;

/**
 * Saves the vendors, stores and items named in an import (new ones are
 * added, names are updated) and returns their ids by code. Shared by every
 * SM import.
 */
class StoreDirectory
{
    private const CHUNK = 500;

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
     * Settlement reports (CSR, CLR) spell store names differently from the
     * DSR, so they only add stores and leave existing names alone.
     *
     * @param  iterable<array{code: string, name: string, company: string}>  $sites
     * @return array<string, int> site id by code
     */
    public function siteIds(iterable $sites, bool $updateNames = true): array
    {
        $rows = collect($sites)->keyBy('code')->values()->all();

        if ($rows === []) {
            return [];
        }

        if ($updateNames) {
            Site::upsert($rows, ['code'], ['name', 'company']);
        } else {
            Site::insertOrIgnore($rows);
        }

        /** @var array<string, int> */
        return Site::whereIn('code', array_column($rows, 'code'))->pluck('id', 'code')->all();
    }

    /**
     * @param  iterable<DsrLineData>  $lines
     * @return array<string, int> article id by article code
     */
    public function articleIds(iterable $lines, bool $updateNames = true): array
    {
        $rows = collect($lines)
            ->keyBy(fn (DsrLineData $l) => $l->articleCode)
            ->map(fn (DsrLineData $l) => [
                'code' => $l->articleCode,
                'description' => $l->description,
                'barcode' => $l->barcode,
                'uom' => $l->uom,
            ])
            ->values();

        $ids = [];

        foreach ($rows->chunk(self::CHUNK) as $chunk) {
            if ($updateNames) {
                Article::upsert($chunk->all(), ['code'], ['description', 'barcode', 'uom']);
            } else {
                Article::insertOrIgnore($chunk->all());
            }

            $ids += Article::whereIn('code', $chunk->pluck('code'))->pluck('id', 'code')->all();
        }

        /** @var array<string, int> $ids */
        return $ids;
    }
}
