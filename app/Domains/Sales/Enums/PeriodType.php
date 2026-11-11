<?php

namespace App\Domains\Sales\Enums;

enum PeriodType: string
{
    case Daily = 'daily';
    case Weekly = 'weekly';
    case Monthly = 'monthly';
    case Quarterly = 'quarterly';
    case Yearly = 'yearly';
    case Custom = 'custom';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
