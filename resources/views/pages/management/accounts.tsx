import { AccountActions } from '@/components/shared/account-actions';
import AutoFilterForm from '@/components/shared/auto-filter-form';
import { FilterToolbar } from '@/components/shared/filter-toolbar';
import { InfoModal } from '@/components/shared/info-modal';
import { Badge, Card, Empty, Field, Page, Pager, roleLabel, Select, type Pagination } from '@/components/shared/marketplace-ui';
import { useInitials } from '@/hooks/use-initials';
import { type SharedData, type User } from '@/types';
import { router, useForm, usePage } from '@inertiajs/react';
import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';

type AccountItem = User & { created_at?: string; application?: { status: string; submitted_at: string | null; reviewed_at: string | null } | null };

function AccountRow({
    account,
    allowedStatuses,
    menuOpen,
    onMenuChange,
    onViewDetails,
    selected,
}: {
    account: AccountItem;
    allowedStatuses: string[];
    menuOpen: boolean;
    onMenuChange: (open: boolean) => void;
    onViewDetails: () => void;
    selected: boolean;
}) {
    const getInitials = useInitials();
    return (
        <Card className={selected ? 'border-primary/30 bg-accent/40' : ''}>
            <div className="flex min-w-0 flex-wrap items-center gap-4">
                <span className="bg-accent text-primary flex size-12 shrink-0 items-center justify-center rounded-full font-semibold">
                    {getInitials(account.name)}
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold break-words">
                        <button
                            type="button"
                            data-account-id={account.id}
                            aria-haspopup="dialog"
                            aria-expanded={selected}
                            onClick={onViewDetails}
                            className="hover:text-primary min-h-6 rounded text-left"
                        >
                            {account.name}
                        </button>
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">{roleLabel(account.role)}</p>
                </div>
                <Badge status={account.status} label={account.status === 'incomplete' ? 'Incomplete registration' : undefined} />
                <AccountActions
                    account={account}
                    canManage={allowedStatuses.some((status) => status !== account.status)}
                    open={menuOpen}
                    onOpenChange={onMenuChange}
                    onViewDetails={onViewDetails}
                    actions={[
                        {
                            id: 'review',
                            label: 'Review in Registrations',
                            icon: ClipboardCheck,
                            visible: account.status === 'pending',
                            onSelect: () => router.visit('/reviews?status=submitted'),
                        },
                    ]}
                />
            </div>
            <div className="mt-4 flex min-w-0 flex-wrap justify-between gap-2 border-t pt-3 text-xs">
                <div className="min-w-0">
                    <p className="text-muted-foreground break-all">{account.email}</p>
                    {account.created_at && (
                        <p className="text-muted-foreground mt-1">
                            Registered {new Date(account.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    )}
                </div>
                <p className="text-muted-foreground">
                    {account.application?.status === 'approved'
                        ? 'Reviewed and approved'
                        : account.application?.status === 'rejected'
                          ? 'Changes requested'
                          : !account.email_verified_at
                            ? 'Email verification needed'
                            : account.application?.status === 'submitted'
                              ? 'Awaiting review'
                              : 'Not yet submitted'}
                </p>
            </div>
        </Card>
    );
}
export default function Accounts({
    accounts,
    filters,
    allowedStatuses,
}: {
    accounts: Pagination<AccountItem>;
    filters: { search?: string; role?: string; status?: string; sort?: string };
    allowedStatuses: string[];
}) {
    const [openMenu, setOpenMenu] = useState<number | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = accounts.data.find((account) => account.id === selectedId);
    const { auth } = usePage<SharedData>().props;
    const center = auth.user.role === 'logistics';
    const search = useForm({
        search: filters.search ?? '',
        role: filters.role ?? '',
        status: filters.status ?? '',
        sort: typeof filters.sort === 'string' ? filters.sort : 'name',
    });
    return (
        <Page
            title={center ? 'Rider management' : 'User Accounts'}
            description={
                center
                    ? 'Review and manage riders assigned to your logistics center.'
                    : 'Review Buyer, Seller, and Logistics accounts. Rider accounts are managed by their Logistics company.'
            }
        >
            {!center && (
                <div role="group" aria-label="Account roles" className="flex flex-wrap gap-3">
                    {[
                        ['', 'All accounts'],
                        ['seller', 'Sellers'],
                        ['buyer', 'Buyers'],
                        ['logistics', 'Logistics'],
                    ].map(([role, label]) => (
                        <button
                            key={role}
                            type="button"
                            aria-pressed={(filters.role ?? '') === role}
                            className={`min-h-11 rounded-xl border px-4 text-sm font-medium ${(filters.role ?? '') === role ? 'border-primary/30 bg-accent text-primary' : 'bg-card hover:bg-accent/40'}`}
                            onClick={() => {
                                search.cancel();
                                router.get('/accounts', { role }, { preserveScroll: true });
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
            <Card className="!p-4">
                <AutoFilterForm
                    processing={search.processing}
                    cancel={search.cancel}
                    className="relative"
                    onSubmit={(e) => {
                        e.preventDefault();
                        search.get('/accounts', { preserveState: true, preserveScroll: true, replace: true });
                    }}
                >
                    <FilterToolbar
                        hasErrors={Object.keys(search.errors).length > 0}
                        primary={
                            <Field
                                reserveFeedback={false}
                                label="Search Accounts"
                                value={search.data.search}
                                onChange={(e) => search.setData('search', e.target.value)}
                            />
                        }
                        activeFilters={[
                            { key: 'search', label: 'Search', value: search.data.search ?? '', onRemove: () => search.setData('search', '') },
                            { key: 'role', label: 'Role', value: search.data.role ?? '', onRemove: () => search.setData('role', '') },
                            { key: 'status', label: 'Status', value: search.data.status ?? '', onRemove: () => search.setData('status', '') },
                            {
                                key: 'sort',
                                label: 'Sort',
                                value:
                                    search.data.sort === 'newest' ? 'Recently registered' : search.data.sort === 'oldest' ? 'Oldest registered' : '',
                                onRemove: () => search.setData('sort', 'name'),
                            },
                        ].filter((filter) => !!filter.value && !(filter.key === 'sort' && filter.value === 'name'))}
                    >
                        <Select
                            reserveFeedback={false}
                            label="Role"
                            value={search.data.role}
                            onChange={(e) => search.setData('role', e.target.value)}
                        >
                            <option value="">All Roles</option>
                            {(center ? ['rider'] : ['buyer', 'seller', 'logistics']).map((role) => (
                                <option key={role} value={role}>
                                    {roleLabel(role)}
                                </option>
                            ))}
                            {!center && <option value="unassigned">No Role Selected</option>}
                        </Select>
                        <Select
                            reserveFeedback={false}
                            label="Status"
                            value={search.data.status}
                            onChange={(e) => search.setData('status', e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            {!center && (
                                <>
                                    <option value="unverified">Unverified</option>
                                    <option value="incomplete">Incomplete Registration</option>
                                    <option value="pending">Pending Review</option>
                                    <option value="rejected">Rejected</option>
                                </>
                            )}
                            <option value="approved">Approved</option>
                            <option value="suspended">Suspended</option>
                            <option value="deactivated">Deactivated</option>
                        </Select>
                        <Select
                            reserveFeedback={false}
                            label="Sort by"
                            value={search.data.sort}
                            onChange={(event) => search.setData('sort', event.target.value)}
                        >
                            <option value="name">Name (A–Z)</option>
                            <option value="newest">Recently registered</option>
                            <option value="oldest">Oldest registered</option>
                        </Select>
                    </FilterToolbar>
                </AutoFilterForm>
            </Card>
            <p className="text-muted-foreground text-sm">
                {accounts.total} {accounts.total === 1 ? 'account' : 'accounts'}
                {filters.search || filters.role || filters.status
                    ? ' matching your filters'
                    : center
                      ? ' in your logistics center'
                      : ' across all registration statuses'}
            </p>
            <div className="min-w-0">
                {accounts.data.length ? (
                    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
                        {accounts.data.map((account) => (
                            <AccountRow
                                key={account.id}
                                account={account}
                                allowedStatuses={allowedStatuses}
                                menuOpen={openMenu === account.id}
                                onMenuChange={(open) => setOpenMenu(open ? account.id : null)}
                                selected={selectedId === account.id}
                                onViewDetails={() => {
                                    setSelectedId(account.id);
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <Empty title="No Accounts Found" description="Accounts you can manage will appear here." />
                )}
                {selected && (
                    <InfoModal
                        key={selected.id}
                        kind="account"
                        id={selected.id}
                        label="Account details"
                        hideTrigger
                        open
                        onOpenChange={(open) => {
                            if (!open) setSelectedId(null);
                        }}
                        onCloseAutoFocus={() =>
                            requestAnimationFrame(() =>
                                document.querySelector<HTMLButtonElement>(`button[data-account-id="${selected.id}"]`)?.focus(),
                            )
                        }
                    />
                )}
            </div>
            <Pager links={accounts.links} />
        </Page>
    );
}
