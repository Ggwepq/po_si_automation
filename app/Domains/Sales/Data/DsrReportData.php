<?php

namespace App\Domains\Sales\Data;

use Carbon\CarbonImmutable;

/** One DSR document (a vendor's sales at a store for a day), as validated from an import. */
final readonly class DsrReportData
{
    /** @param list<DsrLineData> $lines */
    public function __construct(
        public string $vendorCode,
        public string $vendorName,
        public string $siteCode,
        public string $siteName,
        public string $company,
        public CarbonImmutable $transactionDate,
        public ?string $dataStatus,
        public array $lines,
    ) {}

    /** @param array<string, mixed> $report */
    public static function fromArray(array $report): self
    {
        /** @var list<array<string, mixed>> $lines */
        $lines = $report['lines'];
        $status = trim((string) ($report['data_status'] ?? ''));

        return new self(
            vendorCode: trim((string) $report['vendor_code']),
            vendorName: trim((string) $report['vendor_name']),
            siteCode: trim((string) $report['site_code']),
            siteName: trim((string) $report['site_name']),
            company: trim((string) $report['company']),
            transactionDate: CarbonImmutable::createFromFormat('Y-m-d', (string) $report['transaction_date'])->startOfDay(),
            dataStatus: $status === '' ? null : $status,
            lines: array_map(DsrLineData::fromArray(...), $lines),
        );
    }

    /** Identifies the vendor's store-day this document covers. */
    public function key(): string
    {
        return $this->vendorCode.'|'.$this->siteCode.'|'.$this->transactionDate->toDateString();
    }
}
