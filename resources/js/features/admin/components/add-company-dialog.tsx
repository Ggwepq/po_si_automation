import { Form } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import CompanyController from '@/actions/App/Http/Controllers/Admin/CompanyController';
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

/** "Add company" button that opens the form in a dialog. */
export function AddCompanyDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus />
                    Add company
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add a company</DialogTitle>
                    <DialogDescription>
                        Its users will see only this company's sales and
                        imports. You add the users next.
                    </DialogDescription>
                </DialogHeader>
                <Form
                    {...CompanyController.store.form()}
                    resetOnSuccess
                    onSuccess={() => setOpen(false)}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="company-name">
                                    Company name
                                </Label>
                                <Input
                                    id="company-name"
                                    name="name"
                                    required
                                    maxLength={100}
                                    placeholder="e.g. HnF"
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="company-logo">
                                    Logo (optional)
                                </Label>
                                <Input
                                    id="company-logo"
                                    name="logo"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                />
                                <p className="text-xs text-muted-foreground">
                                    PNG, JPG or WebP, up to 2 MB. Shown in the
                                    sidebar and on sales reports.
                                </p>
                                <InputError message={errors.logo} />
                            </div>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Add company
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
