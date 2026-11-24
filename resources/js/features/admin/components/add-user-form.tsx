import { Form } from '@inertiajs/react';
import CompanyUserController from '@/actions/App/Http/Controllers/Admin/CompanyUserController';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { CompanyBrand } from '@/types';

export function AddUserForm({ company }: { company: CompanyBrand }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Add a user</CardTitle>
                <CardDescription>
                    They log in on the usual login page and see only{' '}
                    {company.name}'s data. Share the password with them
                    privately; they can change it under Settings.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form
                    {...CompanyUserController.store.form(company.slug)}
                    resetOnSuccess
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

                            <Button
                                type="submit"
                                disabled={processing}
                                className="justify-self-start"
                            >
                                {processing && <Spinner />}
                                Add user
                            </Button>
                        </>
                    )}
                </Form>
            </CardContent>
        </Card>
    );
}
