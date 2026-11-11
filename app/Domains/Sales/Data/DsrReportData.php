<?php

namespace App\Domains\Sales\Data;

use Carbon\CarbonImmutable;

/** One DSR document (a store's sales for a day), as validated from an import. */
final readonly class DsrReportData
{
    /** @param list<DsrLineData> $lines */
    public function __construct(
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
            siteCode: trim((string) $report['site_code']),
            siteName: trim((string) $report['site_name']),
            company: trim((string) $report['company']),
            transactionDate: CarbonImmutable::createFromFormat('Y-m-d', (string) $report['transaction_date'])->startOfDay(),
            dataStatus: $status === '' ? null : $status,
            lines: array_map(DsrLineData::fromArray(...), $lines),
        );
    }

    /** Identifies the store-day this document covers. */
    public function key(): string
    {
        return $this->siteCode.'|'.$this->transactionDate->toDateString();
    }
}
