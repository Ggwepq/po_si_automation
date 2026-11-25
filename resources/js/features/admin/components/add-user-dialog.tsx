import { Form } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import CompanyUserController from '@/actions/App/Http/Controllers/Admin/CompanyUserController';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
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
import type { CompanyBrand } from '@/types';

/** "Add user" button that opens the form in a dialog. */
export function AddUserDialog({ company }: { company: CompanyBrand }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <UserPlus />
                    Add user
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add a user to {company.name}</DialogTitle>
                    <DialogDescription>
                        They log in on the usual login page and see only{' '}
                        {company.name}'s data. Share the password with them
                        privately; they can change it under Settings.
                    </DialogDescription>
                </DialogHeader>
                <Form
                    {...CompanyUserController.store.form(company.slug)}
                    resetOnSuccess
                    onSuccess={() => setOpen(false)}
                    options={{ preserveScroll: true }}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="user-name">Name</Label>
                                <Input
                                    id="user-name"
                                    name="name"
                                    required
                                    autoComplete="off"
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="user-email">Email</Label>
                                <Input
                                    id="user-email"
                                    name="email"
                                    type="email"
                                    required
                                    autoComplete="off"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="user-password">Password</Label>
                                <PasswordInput
                                    id="user-password"
                                    name="password"
                                    required
                                    autoComplete="new-password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="user-password-confirmation">
                                    Confirm password
                                </Label>
                                <PasswordInput
                                    id="user-password-confirmation"
                                    name="password_confirmation"
                                    required
                                    autoComplete="new-password"
                                />
                            </div>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Add user
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
