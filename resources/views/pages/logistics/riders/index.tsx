import { AccountActions } from '@/components/shared/account-actions';
import { FilterToolbar } from '@/components/shared/filter-toolbar';
import { Badge, Card, Empty, Field, Page, Select } from '@/components/shared/marketplace-ui';
import ValidatedForm from '@/components/shared/validated-form';
import { useInitials } from '@/hooks/use-initials';
import type { User } from '@/types';
import { router, useForm } from '@inertiajs/react';
import { ClipboardCheck, Send } from 'lucide-react';
import { useState } from 'react';

export default function Riders({
    riders,
}: {
    riders: {
        id: number;
        name: string;
        email: string;
        status: User['status'];
        created_at: string;
        email_verified_at: string | null;
        applicationStatus: string | null;
        pendingActivation: boolean;
        applicationId: number | null;
        canReview: boolean;
        canManage: boolean;
    }[];
}) {
    const form = useForm({});
    const [openMenu, setOpenMenu] = useState<number | null>(null);
    const getInitials = useInitials();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [sort, setSort] = useState('name');
    const filters = { search, status, sort };
    const filteredRiders = riders
        .filter((rider) => {
            const query = filters.search.trim().toLocaleLowerCase();
            return (
                (!query || `${rider.name} ${rider.email}`.toLocaleLowerCase().includes(query)) &&
                (!filters.status ||
                    (filters.status === 'activation' ? rider.pendingActivation : !rider.pendingActivation && rider.status === filters.status))
            );
        })
        .sort((a, b) => (filters.sort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
    const statuses = [...new Set(riders.filter((rider) => !rider.pendingActivation).map((rider) => rider.status))].sort();

    return (
        <Page title="Company riders" description="Review and manage rider accounts assigned to your Logistics company.">
            <Card className="!p-4">
                <ValidatedForm
                    className="relative"
                    onSubmit={(event) => {
                        event.preventDefault();
                    }}
                >
                    <FilterToolbar
                        autoSubmit={false}
                        primary={
                            <Field reserveFeedback={false} label="Search riders" value={search} onChange={(event) => setSearch(event.target.value)} />
                        }
                        activeFilters={[
                            { key: 'search', label: 'Search', value: search, onRemove: () => setSearch('') },
                            { key: 'status', label: 'Status', value: status, onRemove: () => setStatus('') },
                            { key: 'sort', label: 'Sort', value: sort === 'name' ? '' : 'Name (Z to A)', onRemove: () => setSort('name') },
                        ].filter((filter) => !!filter.value)}
                    >
                        <Select reserveFeedback={false} label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
                            <option value="">All statuses</option>
                            {riders.some((rider) => rider.pendingActivation) && <option value="activation">Awaiting activation</option>}
                            {statuses.map((value) => (
                                <option key={value} value={value}>
                                    {value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())}
                                </option>
                            ))}
                        </Select>
                        <Select reserveFeedback={false} label="Sort by" value={sort} onChange={(event) => setSort(event.target.value)}>
                            <option value="name">Name (A to Z)</option>
                            <option value="name-desc">Name (Z to A)</option>
                        </Select>
                    </FilterToolbar>
                </ValidatedForm>
            </Card>
            <p className="text-muted-foreground text-sm" role="status">
                {filteredRiders.length} {filteredRiders.length === 1 ? 'rider' : 'riders'}
                {filters.search || filters.status ? ' matching your filters' : ' in your Logistics company'}
            </p>
            {filteredRiders.length ? (
                <div className="grid items-start gap-4 xl:grid-cols-2">
                    {filteredRiders.map((rider) => (
                        <Card key={rider.id}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span
                                        aria-hidden="true"
                                        className="bg-accent/70 text-primary flex size-11 shrink-0 items-center justify-center rounded-full font-semibold"
                                    >
                                        {getInitials(rider.name)}
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-semibold break-words">{rider.name}</h2>
                                        <p className="text-muted-foreground mt-1 text-xs">Rider</p>
                                    </div>
                                </div>
                                <AccountActions
                                    account={rider}
                                    canView={rider.canManage}
                                    canManage={rider.canManage}
                                    open={openMenu === rider.id}
                                    onOpenChange={(open) => setOpenMenu(open ? rider.id : null)}
                                    actions={[
                                        {
                                            id: 'resend',
                                            label: 'Resend activation',
                                            icon: Send,
                                            visible: rider.pendingActivation,
                                            loading: form.processing,
                                            onSelect: () => form.post(route('logistics.riders.resend', rider.id)),
                                        },
                                        {
                                            id: 'review',
                                            label: 'Review application',
                                            icon: ClipboardCheck,
                                            visible: !!(rider.canReview && rider.applicationId),
                                            onSelect: () => router.visit(route('reviews.show', rider.applicationId!)),
                                        },
                                    ]}
                                />
                            </div>
                            <div className="mt-3">
                                <Badge
                                    status={rider.pendingActivation ? 'pending' : rider.status}
                                    label={rider.pendingActivation ? 'Awaiting activation' : undefined}
                                />
                            </div>
                            <p className="text-muted-foreground mt-3 text-sm break-all">{rider.email}</p>
                            <p className="text-muted-foreground mt-2 text-xs">
                                Registered{' '}
                                {new Date(rider.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                                <span className="text-muted-foreground">Registration</span>
                                <span className="font-medium">
                                    {rider.applicationStatus === 'approved'
                                        ? 'Reviewed and approved'
                                        : rider.applicationStatus === 'rejected'
                                          ? 'Changes requested'
                                          : rider.pendingActivation
                                            ? 'Awaiting activation'
                                            : !rider.email_verified_at
                                              ? 'Email verification needed'
                                              : rider.applicationStatus === 'submitted'
                                                ? 'Awaiting review'
                                                : 'Not yet submitted'}
                                </span>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Empty
                    title={riders.length ? 'No matching riders' : 'No riders yet'}
                    description={
                        riders.length ? 'Try another name, email, or status.' : 'Riders assigned to your Logistics company will appear here.'
                    }
                />
            )}
        </Page>
    );
}
