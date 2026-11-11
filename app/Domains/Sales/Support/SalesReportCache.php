<?php

namespace App\Domains\Sales\Support;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Short-lived cache for sales reports. Every import bumps a version number,
 * so cached reports never outlive the data they were built from (this works
 * on any cache driver, including the database driver used on shared hosting).
 */
class SalesReportCache
{
    private const VERSION_KEY = 'sales-report:version';

    private const TTL_SECONDS = 600;

    /**
     * @template T
     *
     * @param  array<string, scalar|null>  $parameters
     * @param  Closure(): T  $build
     * @return T
     */
    public function remember(array $parameters, Closure $build): mixed
    {
        $version = (int) Cache::get(self::VERSION_KEY, 0);
        $key = 'sales-report:'.$version.':'.md5((string) json_encode($parameters));

        return Cache::remember($key, self::TTL_SECONDS, $build);
    }

    public function flush(): void
    {
        Cache::forever(self::VERSION_KEY, (int) Cache::get(self::VERSION_KEY, 0) + 1);
    }
}
