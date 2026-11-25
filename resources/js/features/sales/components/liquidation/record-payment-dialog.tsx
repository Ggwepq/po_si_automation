import { Form } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import LiquidationController from '@/actions/App/Http/Controllers/Sales/LiquidationController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatMoney } from '../../lib/format';
import { periodLabel } from '../../lib/liquidation';
import type { Liquidation } from '../../lib/types';

/** Records money received from SM for a liquidation, e.g. one check from the Remittance Advice. */
export function RecordPaymentDialog({
    liquidation,
    today,
}: {
    liquidation: Liquidation;
    today: string;
}) {
    const [open, setOpen] = useState(false);
    const balance = Math.max(liquidation.balance, 0);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Plus />
                    Record payment
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Record payment</DialogTitle>
                    <DialogDescription>
                        {liquidation.centerName},{' '}
                        {periodLabel(
                            liquidation.periodStart,
                            liquidation.periodEnd,
                        )}
                        . Net due {formatMoney(liquidation.netDue)}
                        {liquidation.paid > 0 &&
                            `, ${formatMoney(balance)} still to receive`}
                        .
                    </DialogDescription>
                </DialogHeader>
                <Form
                    {...LiquidationController.storePayment.form(liquidation.id)}
                    options={{ preserveScroll: true }}
                    resetOnSuccess
                    onSuccess={() => setOpen(false)}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="payment-amount">
                                        Amount received (₱)
                                    </Label>
                                    <Input
                                        id="payment-amount"
                                        name="amount"
                                        inputMode="decimal"
                                        required
                                        autoFocus
                                        defaultValue={balance.toFixed(2)}
                                    />
                                    <InputError message={errors.amount} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="payment-date">
                                        Date received
                                    </Label>
                                    <Input
                                        id="payment-date"
                                        name="paid_on"
                                        type="date"
                                        required
                                        max={today}
                                        defaultValue={today}
                                    />
                                    <InputError message={errors.paid_on} />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="payment-reference">
                                    Check or reference no. (optional)
                                </Label>
                                <Input
                                    id="payment-reference"
                                    name="reference"
                                    maxLength={100}
                                    placeholder="e.g. 8700031359"
                                />
                                <InputError message={errors.reference} />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Save payment
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
