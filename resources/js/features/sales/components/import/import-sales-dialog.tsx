import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { ImportFlow } from './import-flow';

/**
 * "Import DSR" from any page: the same flow as the Import page, in a dialog.
 * Pass open/onOpenChange to open it from elsewhere too (e.g. an empty
 * state's button), so one dialog stays mounted while the page fills in.
 */
export function ImportSalesDialog({
    label = 'Import DSR',
    variant = 'default',
    open: controlledOpen,
    onOpenChange,
}: {
    label?: string;
    variant?: 'default' | 'outline';
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [ownOpen, setOwnOpen] = useState(false);
    const open = controlledOpen ?? ownOpen;
    const setOpen = onOpenChange ?? setOwnOpen;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant={variant}>
                    <FileUp />
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Import from the SM Vendor Portal</DialogTitle>
                    <DialogDescription>
                        The file is read in your browser and checked before
                        anything is saved.
                    </DialogDescription>
                </DialogHeader>
                {/* Remounted on open, so every visit starts at step 1. */}
                {open && <ImportFlow onFinished={() => setOpen(false)} />}
            </DialogContent>
        </Dialog>
    );
}
