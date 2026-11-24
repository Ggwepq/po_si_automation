import { Form } from '@inertiajs/react';
import CompanyController from '@/actions/App/Http/Controllers/Admin/CompanyController';
import InputError from '@/components/input-error';
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

export function AddCompanyForm() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Add a company</CardTitle>
                <CardDescription>
                    Its users will see only this company's sales and imports.
                    You add the users on the next page.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form
                    {...CompanyController.store.form()}
                    resetOnSuccess
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

                            <Button
                                type="submit"
                                disabled={processing}
                                className="justify-self-start"
                            >
                                {processing && <Spinner />}
                                Add company
                            </Button>
                        </>
                    )}
                </Form>
            </CardContent>
        </Card>
    );
}
