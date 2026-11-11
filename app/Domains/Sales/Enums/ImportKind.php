<?php

namespace App\Domains\Sales\Enums;

enum ImportKind: string
{
    /** Item-level DSR ("Export Document"): builds the sales report. */
    case Detail = 'detail';

    /** SM's DSR Summary: daily totals used to check the DSR lines. */
    case Summary = 'summary';

    public function label(): string
    {
        return match ($this) {
            self::Detail => 'DSR',
            self::Summary => 'DSR Summary',
        };
    }
}
