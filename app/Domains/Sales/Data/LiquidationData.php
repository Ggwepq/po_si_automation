<?php

namespace App\Domains\Sales\Data;

use Carbon\CarbonImmutable;

/** What one SM chain head office owes for a half-month, from the Consolidated Liquidation Report. */
final readonly class LiquidationData
{
    /**
     * @param  numeric-string  $amountPayable
     * @param  numeric-string  $ewt
     * @param  numeric-string  $netDue
     * @param  list<array{site_code: string, site_name: string, company: string, vat_exempt_sales: numeric-string, vatable_sales: numeric-string, vat_amount: numeric-string, total_sales: numeric-string}>  $stores
     */
    public function __construct(
        public string $vendorCode,
        public string $vendorName,
        public string $centerCode,
        public string $centerName,
        public string $chain,
        public ?string $paymentTerm,
        public CarbonImmutable $periodStart,
        public CarbonImmutable $periodEnd,
        public string $amountPayable,
        public string $ewt,
        public string $netDue,
        public array $stores,
    ) {}

    /** @param array<string, mixed> $row */
    public static function fromArray(array $row): self
    {
        /** @var list<array{site_code: string, site_name: string, company: string, vat_exempt_sales: numeric-string, vatable_sales: numeric-string, vat_amount: numeric-string, total_sales: numeric-string}> $stores */
        $stores = array_map(fn (array $s) => [
            'site_code' => trim((string) $s['site_code']),
            'site_name' => trim((string) $s['site_name']),
            'company' => trim((string) $s['company']),
            'vat_exempt_sales' => (string) $s['vat_exempt_sales'],
            'vatable_sales' => (string) $s['vatable_sales'],
            'vat_amount' => (string) $s['vat_amount'],
            'total_sales' => (string) $s['total_sales'],
        ], $row['stores']);

        /** @var numeric-string $payable */
        $payable = (string) $row['amount_payable'];
        /** @var numeric-string $ewt */
        $ewt = (string) $row['ewt'];
        /** @var numeric-string $net */
        $net = (string) $row['net_due'];
        $term = trim((string) ($row['payment_term'] ?? ''));

        return new self(
            vendorCode: trim((string) $row['vendor_code']),
            vendorName: trim((string) $row['vendor_name']),
            centerCode: trim((string) $row['center_code']),
            centerName: trim((string) $row['center_name']),
            chain: trim((string) $row['chain']),
            paymentTerm: $term === '' ? null : $term,
            periodStart: CarbonImmutable::createFromFormat('Y-m-d', (string) $row['period_start'])->startOfDay(),
            periodEnd: CarbonImmutable::createFromFormat('Y-m-d', (string) $row['period_end'])->startOfDay(),
            amountPayable: $payable,
            ewt: $ewt,
            netDue: $net,
            stores: $stores,
        );
    }

    public function key(): string
    {
        return $this->vendorCode.'|'.$this->centerCode.'|'.$this->periodStart->toDateString().'|'.$this->periodEnd->toDateString();
    }
}
