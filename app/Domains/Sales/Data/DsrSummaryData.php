<?php

namespace App\Domains\Sales\Data;

use Carbon\CarbonImmutable;

/** SM's official total for one vendor, store and day, from a DSR Summary export. */
final readonly class DsrSummaryData
{
    /** @param numeric-string $totalSales */
    public function __construct(
        public string $vendorCode,
        public string $vendorName,
        public string $siteCode,
        public string $siteName,
        public string $company,
        public CarbonImmutable $transactionDate,
        public string $totalSales,
    ) {}

    /** @param array<string, mixed> $summary */
    public static function fromArray(array $summary): self
    {
        /** @var numeric-string $total */
        $total = (string) $summary['total_sales'];

        return new self(
            vendorCode: trim((string) $summary['vendor_code']),
            vendorName: trim((string) $summary['vendor_name']),
            siteCode: trim((string) $summary['site_code']),
            siteName: trim((string) $summary['site_name']),
            company: trim((string) $summary['company']),
            transactionDate: CarbonImmutable::createFromFormat('Y-m-d', (string) $summary['transaction_date'])->startOfDay(),
            totalSales: $total,
        );
    }

    public function key(): string
    {
        return $this->vendorCode.'|'.$this->siteCode.'|'.$this->transactionDate->toDateString();
    }
}
