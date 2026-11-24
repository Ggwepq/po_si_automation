<?php

namespace App\Domains\Sales\Data;

/**
 * Which sales a report covers: always one company's (the signed-in user's),
 * narrowed by vendor, store chain and store. Empty lists mean "all".
 */
final readonly class ReportFilter
{
    /**
     * @param  list<string>  $vendorCodes
     * @param  list<string>  $companies
     * @param  list<string>  $siteCodes
     */
    public function __construct(
        public int $companyId,
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
            'company' => (string) $this->companyId,
            'vendors' => $sorted($this->vendorCodes),
            'companies' => $sorted($this->companies),
            'sites' => $sorted($this->siteCodes),
        ];
    }
}
