<?php

namespace App\Domains\Sales\Data;

/** One item line of a DSR, as validated from an import. */
final readonly class DsrLineData
{
    /**
     * @param  numeric-string  $salesQty
     * @param  numeric-string  $vatExemptSales
     * @param  numeric-string  $vatableSales
     * @param  numeric-string  $totalSales
     */
    public function __construct(
        public string $articleCode,
        public string $description,
        public ?string $barcode,
        public ?string $uom,
        public string $salesQty,
        public string $vatExemptSales,
        public string $vatableSales,
        public string $totalSales,
    ) {}

    /** @param array<string, mixed> $line */
    public static function fromArray(array $line): self
    {
        return new self(
            articleCode: trim((string) $line['article_code']),
            description: trim((string) $line['description']),
            barcode: self::optional($line['barcode'] ?? null),
            uom: self::optional($line['uom'] ?? null),
            salesQty: self::decimal($line['sales_qty']),
            vatExemptSales: self::decimal($line['vat_exempt_sales']),
            vatableSales: self::decimal($line['vatable_sales']),
            totalSales: self::decimal($line['total_sales']),
        );
    }

    /** @return numeric-string */
    private static function decimal(mixed $value): string
    {
        $text = is_scalar($value) ? trim((string) $value) : '';

        if (! is_numeric($text)) {
            throw new \InvalidArgumentException("Expected a number, got \"{$text}\".");
        }

        return $text;
    }

    private static function optional(mixed $value): ?string
    {
        $text = is_scalar($value) ? trim((string) $value) : '';

        return $text === '' ? null : $text;
    }
}
