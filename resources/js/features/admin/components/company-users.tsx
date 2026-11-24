import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { CompanyUserRow, Paginated } from '../types';
import { PageLinks } from './page-links';

export function CompanyUsers({ users }: { users: Paginated<CompanyUserRow> }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
                {users.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No users yet. Add one so this company can log in.
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Added</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.data.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">
                                            {user.name}
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {user.createdAt
                                                ? new Date(
                                                      user.createdAt,
                                                  ).toLocaleDateString('en-PH')
                                                : '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                <PageLinks page={users} />
            </CardContent>
        </Card>
    );
}
