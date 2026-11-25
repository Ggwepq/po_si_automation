<?php

namespace App\Domains\Sales\Enums;

enum ImportKind: string
{
    /** Item-level DSR ("Export Document"): builds the sales report. */
    case Detail = 'detail';

    /** SM's DSR Summary: daily totals used to check the DSR lines. */
    case Summary = 'summary';

    /** SM's Consolidated Sales Report: per store and item for a half-month. */
    case Csr = 'csr';

    /** SM's Consolidated Liquidation Report: what each chain owes for a half-month. */
    case Clr = 'clr';

    public function label(): string
    {
        return match ($this) {
            self::Detail => 'DSR',
            self::Summary => 'DSR Summary',
            self::Csr => 'Consolidated Sales Report',
            self::Clr => 'Consolidated Liquidation Report',
        };
    }
}
