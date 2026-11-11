<?php

namespace App\Domains\Sales\Data;

/** Which sales a report covers. Empty lists mean "all". */
final readonly class ReportFilter
{
    /**
     * @param  list<string>  $vendorCodes
     * @param  list<string>  $companies
     * @param  list<string>  $siteCodes
     */
    public function __construct(
        public array $vendorCodes = [],
        public array $companies = [],
        public array $siteCodes = [],
    ) {}

    /** @return array<string, string> stable values for cache keys */
    public function cacheKey(): array
    {
        $sorted = function (array $values): string {
            sort($values);

            return implode(',', $values);
        };

        return [
            'vendors' => $sorted($this->vendorCodes),
            'companies' => $sorted($this->companies),
            'sites' => $sorted($this->siteCodes),
        ];
    }
}
