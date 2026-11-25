<?php

namespace App\Domains\Sales\Data;

use Carbon\CarbonImmutable;

/** One store's items for a half-month, from SM's Consolidated Sales Report. */
final readonly class CsrStoreData
{
    /** @param list<DsrLineData> $lines */
    public function __construct(
        public string $vendorCode,
        public string $vendorName,
        public string $siteCode,
        public string $siteName,
        public string $company,
        public CarbonImmutable $periodStart,
        public CarbonImmutable $periodEnd,
        public array $lines,
    ) {}

    /** @param array<string, mixed> $store */
    public static function fromArray(array $store): self
    {
        /** @var list<array<string, mixed>> $lines */
        $lines = $store['lines'];

        return new self(
            vendorCode: trim((string) $store['vendor_code']),
            vendorName: trim((string) $store['vendor_name']),
            siteCode: trim((string) $store['site_code']),
            siteName: trim((string) $store['site_name']),
            company: trim((string) $store['company']),
            periodStart: CarbonImmutable::createFromFormat('Y-m-d', (string) $store['period_start'])->startOfDay(),
            periodEnd: CarbonImmutable::createFromFormat('Y-m-d', (string) $store['period_end'])->startOfDay(),
            lines: array_map(DsrLineData::fromArray(...), $lines),
        );
    }

    public function key(): string
    {
        return $this->vendorCode.'|'.$this->siteCode.'|'.$this->periodStart->toDateString().'|'.$this->periodEnd->toDateString();
    }
}
