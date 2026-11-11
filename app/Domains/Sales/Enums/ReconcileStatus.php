<?php

namespace App\Domains\Sales\Enums;

/** How one store-day of SM's DSR Summary compares with the imported DSR lines. */
enum ReconcileStatus: string
{
    case Match = 'match';

    /** Summary is 0.00 and there is no DSR: the store sold nothing. */
    case NoSales = 'no_sales';

    case Differs = 'differs';

    /** Summary shows sales but the DSR for that store-day is not imported. */
    case NotImported = 'not_imported';

    /** A DSR is imported for a store-day the Summary does not list. */
    case NotInSummary = 'not_in_summary';

    public function isIssue(): bool
    {
        return in_array($this, [self::Differs, self::NotImported, self::NotInSummary], true);
    }
}
