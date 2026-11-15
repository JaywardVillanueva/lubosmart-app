import { FilterToolbar } from '@/components/shared/filter-toolbar';
import { Badge, Card, Field, Page, Pager, Select, buttonClass, roleLabel, secondaryClass, type Pagination } from '@/components/shared/marketplace-ui';
import ValidatedForm from '@/components/shared/validated-form';
import { NewConversation } from '@/components/support/new-conversation';
import Conversation from '@/pages/support/show';
import { type SharedData } from '@/types';
import { router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Circle, Mail, MessageCircle, ShieldCheck, SquarePen } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentProps } from 'react';

type Case = {
    id: number;
    kind: string;
    subject: string;
    status: string;
    seller_order_id: number | null;
    participants: { id: number; name: string; role: string }[];
    unread_count: number;
    latest_message: { body: string; created_at: string; author: { id: number; name: string } } | null;
};
type Thread = ComponentProps<typeof Conversation>;
export default function Support({
    cases,
    filters,
}: {
    cases: Pagination<Case>;
    filters: { kind?: string; status?: string; search?: string; unread?: string };
}) {
    const { auth } = usePage<SharedData>().props;
    const canChooseRecipient = ['admin', 'logistics'].includes(auth.user.role);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<number | null>(null);
    const [thread, setThread] = useState<Thread | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [pageUrl, setPageUrl] = useState<string | null>(null);
    const [composing, setComposing] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const inboxHeading = useRef<HTMLHeadingElement>(null);
    const search = useForm({
        kind: filters.kind ?? '',
        status: filters.status ?? '',
        search: filters.search ?? '',
        unread: filters.unread ? '1' : '',
    });
    const filtered = !!(search.data.kind || search.data.status || search.data.search || search.data.unread);
    const { data: filterData, get: getConversations } = search;
    useEffect(() => {
        if (composing) return;
        if (
            filterData.kind === (filters.kind ?? '') &&
            filterData.status === (filters.status ?? '') &&
            filterData.search === (filters.search ?? '') &&
            filterData.unread === (filters.unread ? '1' : '')
        )
            return;
        const timer = setTimeout(() => getConversations('/support', { preserveState: true, preserveScroll: true, replace: true }), 350);
        return () => clearTimeout(timer);
    }, [composing, filterData, getConversations, filters.kind, filters.status, filters.search, filters.unread]);
    useEffect(() => {
        if (creating || search.processing) return;
        const timer = setInterval(() => {
            if (document.hidden) return;
            if (selected && !pageUrl && document.hasFocus()) setAttempt((value) => value + 1);
            else router.reload({ only: ['cases', 'adminWorkspace'] });
        }, 30000);
        return () => clearInterval(timer);
    }, [selected, creating, pageUrl, search.processing, search.data.kind, search.data.status, search.data.search, search.data.unread]);
    useEffect(() => {
        if (!selected) return;
        const controller = new AbortController();
        setError('');
        fetch(pageUrl ?? `/support/${selected}`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal })
            .then(async (response) => {
                if (!response.ok)
                    throw Error(
                        response.status === 403
                            ? 'You no longer have access to this conversation.'
                            : 'Could not load this conversation. Please try again.',
                    );
                return response.json();
            })
            .then((data) => {
                if (controller.signal.aborted) return;
                setThread(data);
                router.reload({ only: ['cases', 'adminWorkspace'] });
            })
            .catch((reason) => {
                if (!controller.signal.aborted) setError(reason.message);
            });
        return () => controller.abort();
    }, [selected, attempt, pageUrl]);
    useEffect(() => {
        if (selected) heading.current?.focus();
    }, [selected]);
    const refresh = () => {
        setPageUrl(null);
        setAttempt((value) => value + 1);
    };
    const clear = () => {
        search.setData({ kind: '', status: '', search: '', unread: '' });
        router.get('/support', {}, { preserveState: true, preserveScroll: true, replace: true });
    };
    return (
        <Page
            title="Messages"
            description="Keep conversations, order concerns, and support cases together."
            action={
                <button className={buttonClass} onClick={() => setCreating(true)}>
                    <SquarePen aria-hidden="true" className="size-4" />
                    {canChooseRecipient ? 'New Conversation' : 'Contact Support'}
                </button>
            }
        >
            <NewConversation open={creating} onOpenChange={setCreating} admin={canChooseRecipient} kind={filters.kind} />
            <div role="group" aria-label="Conversation filters" className="flex flex-wrap gap-3">
                {[
                    { label: 'All conversations', kind: '', unread: '', icon: MessageCircle },
                    { label: 'Unread', kind: '', unread: '1', icon: Circle },
                    { label: 'General messages', kind: 'message', unread: '', icon: Mail },
                    { label: 'Complaints and disputes', kind: 'complaint', unread: '', icon: ShieldCheck },
                ].map((item) => {
                    const active = search.data.kind === item.kind && search.data.unread === item.unread;
                    return (
                        <button
                            key={item.label}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                                search.cancel();
                                search.setData({ search: '', status: '', kind: item.kind, unread: item.unread });
                            }}
                            className={`${secondaryClass} ${active ? 'border-primary/50 bg-accent text-primary' : 'bg-card'}`}
                        >
                            <item.icon aria-hidden="true" className="size-4" />
                            {item.label}
                        </button>
                    );
                })}
            </div>
            <Card className="!p-4">
                <ValidatedForm
                    aria-busy={search.processing}
                    onCompositionStart={() => setComposing(true)}
                    onCompositionEnd={() => setComposing(false)}
                    className="relative"
                    onSubmit={(event) => {
                        event.preventDefault();
                        search.get('/support', { preserveState: true, preserveScroll: true, replace: true });
                    }}
                >
                    <FilterToolbar
                        hasErrors={Object.keys(search.errors).length > 0}
                        autoSubmit={false}
                        primary={
                            <Field
                                reserveFeedback={false}
                                label="Search conversations"
                                type="search"
                                maxLength={100}
                                placeholder="Name, topic or parcel number"
                                value={search.data.search}
                                onChange={(e) => search.setData('search', e.target.value)}
                            />
                        }
                        activeFilters={[
                            { key: 'search', label: 'Search', value: search.data.search, onRemove: () => search.setData('search', '') },
                            { key: 'kind', label: 'Topic', value: search.data.kind, onRemove: () => search.setData('kind', '') },
                            { key: 'status', label: 'Status', value: search.data.status, onRemove: () => search.setData('status', '') },
                            {
                                key: 'unread',
                                label: 'Read status',
                                value: search.data.unread ? 'Unread' : '',
                                onRemove: () => search.setData('unread', ''),
                            },
                        ].filter((filter) => !!filter.value)}
                    >
                        <Select
                            reserveFeedback={false}
                            label="Topic"
                            value={search.data.kind}
                            onChange={(e) => search.setData('kind', e.target.value)}
                        >
                            <option value="">All Conversations</option>
                            <option value="message">General Messages</option>
                            <option value="complaint">Complaints &amp; Disputes</option>
                        </Select>
                        <Select
                            reserveFeedback={false}
                            label="Status"
                            value={search.data.status}
                            onChange={(e) => search.setData('status', e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="open">Open</option>
                            <option value="in_review">In Review</option>
                            <option value="resolved">Resolved</option>
                        </Select>
                        <Select
                            reserveFeedback={false}
                            label="Read status"
                            value={search.data.unread}
                            onChange={(e) => search.setData('unread', e.target.value)}
                        >
                            <option value="">All conversations</option>
                            <option value="1">Unread</option>
                        </Select>
                    </FilterToolbar>
                    <p role="status" className={search.processing ? 'text-muted-foreground mt-2 text-xs' : 'sr-only'}>
                        {search.processing ? 'Updating results...' : ''}
                    </p>
                </ValidatedForm>
            </Card>
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <section aria-label="Conversation inbox" className={selected ? 'hidden min-w-0 lg:block' : 'min-w-0'}>
                    <Card className="overflow-hidden !p-0">
                        <div className="border-b p-4">
                            <h2 ref={inboxHeading} tabIndex={-1} className="font-semibold">
                                Inbox
                            </h2>
                            <p className="text-muted-foreground text-xs">{cases.total} conversations · Latest activity first</p>
                        </div>
                        {cases.data.length ? (
                            <ul className="divide-y">
                                {cases.data.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            aria-current={selected === item.id ? 'true' : undefined}
                                            className={`hover:bg-accent/40 focus-visible:ring-ring flex w-full min-w-0 gap-3 rounded-xl p-4 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset ${selected === item.id ? 'bg-accent' : ''}`}
                                            onClick={() => {
                                                if (selected === item.id) return;
                                                setSelected(item.id);
                                                setThread(null);
                                                setPageUrl(null);
                                                setError('');
                                            }}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className="bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                                            >
                                                {item.subject.slice(0, 2).toUpperCase()}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <h3 className="min-w-0 text-sm font-semibold break-words">{item.subject}</h3>
                                                    {item.unread_count > 0 && (
                                                        <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                                                            {item.unread_count} unread
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-muted-foreground mt-1 truncate text-xs">
                                                    {item.participants
                                                        .filter((person) => person.id !== auth.user.id)
                                                        .map((person) => `${person.name} (${roleLabel(person.role)})`)
                                                        .join(', ') || 'LubosMart Support'}
                                                </p>
                                                <p className="text-muted-foreground mt-2 truncate text-sm">
                                                    {item.latest_message
                                                        ? `${item.latest_message.author.id === auth.user.id ? 'You' : item.latest_message.author.name}: ${item.latest_message.body}`
                                                        : 'No messages yet'}
                                                </p>
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <Badge status={item.status} />
                                                    <span className="text-muted-foreground text-xs">
                                                        {item.kind === 'complaint' ? 'Complaint' : 'Message'} #{item.id}
                                                        {item.seller_order_id ? ` · Parcel #${item.seller_order_id}` : ''}
                                                    </span>
                                                </div>
                                                {item.latest_message && (
                                                    <time
                                                        dateTime={item.latest_message.created_at}
                                                        className="text-muted-foreground mt-2 block text-xs"
                                                    >
                                                        {new Date(item.latest_message.created_at).toLocaleString('en-PH', {
                                                            dateStyle: 'medium',
                                                            timeStyle: 'short',
                                                        })}
                                                    </time>
                                                )}
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="grid justify-items-center gap-3 p-6 text-center">
                                <MessageCircle aria-hidden="true" className="text-primary size-8" />
                                <h3 className="font-semibold">{filtered ? 'No matching conversations' : 'No conversations yet'}</h3>
                                <p className="text-muted-foreground text-sm">
                                    {filtered ? 'Try another search or clear your filters.' : 'Your messages and support replies will appear here.'}
                                </p>
                                <button type="button" className={secondaryClass} onClick={filtered ? clear : () => setCreating(true)}>
                                    {filtered ? 'Clear Filters' : 'New Conversation'}
                                </button>
                            </div>
                        )}
                    </Card>
                    <Pager links={cases.links} />
                </section>
                <section aria-label="Selected conversation" className={selected ? 'min-w-0' : 'hidden min-w-0 lg:block'}>
                    {selected ? (
                        <Card className="overflow-hidden !p-0">
                            <div className="flex flex-wrap items-center gap-3 border-b p-4">
                                <button
                                    type="button"
                                    className={secondaryClass}
                                    onClick={() => {
                                        setSelected(null);
                                        setThread(null);
                                        requestAnimationFrame(() => inboxHeading.current?.focus());
                                    }}
                                >
                                    <ArrowLeft aria-hidden="true" className="size-4" />
                                    Back to Inbox
                                </button>
                                <h2 ref={heading} tabIndex={-1} className="text-sm font-semibold">
                                    Conversation #{selected}
                                </h2>
                                <button className={secondaryClass} type="button" onClick={refresh}>
                                    Refresh
                                </button>
                            </div>
                            {error && (
                                <div role="alert" className="grid gap-3 p-6">
                                    <p>{error}</p>
                                    <button type="button" className={secondaryClass} onClick={refresh}>
                                        Try again
                                    </button>
                                </div>
                            )}
                            {thread ? (
                                <Conversation
                                    key={selected}
                                    {...thread}
                                    embedded
                                    onSaved={refresh}
                                    onPageChange={(url) => {
                                        setPageUrl(url);
                                    }}
                                />
                            ) : !error ? (
                                <p role="status" className="text-muted-foreground p-6 text-sm">
                                    Loading conversation…
                                </p>
                            ) : null}
                        </Card>
                    ) : (
                        <Card className="grid min-h-64 content-center justify-items-center gap-3 text-center">
                            <MessageCircle aria-hidden="true" className="text-primary size-8" />
                            <h2 className="font-semibold">Select a conversation</h2>
                            <p className="text-muted-foreground max-w-xs text-sm">
                                Choose a message from your inbox to read replies and continue the conversation.
                            </p>
                        </Card>
                    )}
                </section>
            </div>
        </Page>
    );
}
