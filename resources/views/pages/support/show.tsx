import {
    Badge,
    Card,
    Field,
    Page,
    Pager,
    Select,
    Textarea,
    buttonClass,
    roleLabel,
    secondaryClass,
    type Pagination,
} from '@/components/shared/marketplace-ui';
import { ReasonConfirmation } from '@/components/shared/reason-confirmation';
import ValidatedForm from '@/components/shared/validated-form';
import { fulfillmentConcerns } from '@/components/support/fulfillment-concerns';
import { type SharedData } from '@/types';
import { Link, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState, type ComponentProps } from 'react';

function EmbeddedConversation({ title, description, children }: ComponentProps<typeof Page>) {
    return (
        <div className="grid min-w-0 gap-4 p-4">
            <header>
                <h3 className="text-lg font-semibold break-words">{title}</h3>
                <p className="text-muted-foreground mt-1 text-xs">{description}</p>
            </header>
            {children}
        </div>
    );
}
type Case = {
    id: number;
    subject: string;
    status: string;
    kind: string;
    resolution: string | null;
    participants: { id: number; name: string; role: string }[];
    seller_order_id: number | null;
    fulfillment_concern?: string | null;
};
type Message = {
    id: number;
    body: string;
    user_id: number;
    attachment_name: string | null;
    created_at: string;
    author: { name: string; role: string };
};
export default function Conversation({
    case: thread,
    messages,
    embedded = false,
    onSaved,
    onPageChange,
}: {
    case: Case;
    messages: Pagination<Message> & { current_page?: number };
    embedded?: boolean;
    onSaved?: () => void;
    onPageChange?: (url: string) => void;
}) {
    const { auth } = usePage<SharedData>().props;
    const admin = auth.user.role === 'admin';
    const form = useForm({ body: '', attachment: null as File | null });
    const [confirming, setConfirming] = useState(false);
    const decision = useForm({ status: thread.status, resolution: thread.resolution ?? '' });
    const [fileKey, setFileKey] = useState(0);
    const end = useRef<HTMLLIElement>(null);
    const latestId = messages.data[0]?.id;
    useEffect(() => {
        if ((messages.current_page ?? 1) === 1) end.current?.scrollIntoView({ block: 'nearest' });
    }, [latestId, messages.current_page]);
    const Container = embedded ? EmbeddedConversation : Page;
    return (
        <Container
            embedded={embedded}
            title={thread.subject}
            description={`Conversation #${thread.id}${thread.seller_order_id ? ` · Parcel #${thread.seller_order_id}` : ''}`}
            action={
                !embedded && (
                    <Link href="/support" className={secondaryClass}>
                        Back to Inbox
                    </Link>
                )
            }
        >
            <Card>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge status={thread.status} />
                    <span className="text-muted-foreground text-sm">
                        {thread.participants.map((person) => `${person.name} (${roleLabel(person.role)})`).join(', ')}
                    </span>
                </div>
                {thread.fulfillment_concern && (
                    <p className="mt-4 text-sm">
                        Reported concern: {fulfillmentConcerns[thread.fulfillment_concern] ?? thread.fulfillment_concern}. This is an allegation for
                        Admin review; reporting or resolving it does not create a charge or account penalty.
                    </p>
                )}
                {thread.resolution && (
                    <p className="mt-4 text-sm break-words whitespace-pre-wrap">
                        <span className="font-medium">Resolution: </span>
                        {thread.resolution}
                    </p>
                )}
            </Card>
            <div className="grid items-start gap-6">
                <div className="grid gap-4">
                    <Card>
                        <h2 className="mb-5 font-semibold">Conversation</h2>
                        <ol aria-label="Message history" className="max-h-[48dvh] space-y-4 overflow-y-auto overscroll-contain pr-2">
                            {!messages.data.length && (
                                <li className="text-muted-foreground py-6 text-center text-sm">No messages yet. Send a reply below.</li>
                            )}
                            {[...messages.data].reverse().map((message, index, history) => (
                                <li
                                    key={message.id}
                                    className={`w-fit max-w-[95%] rounded-2xl p-4 [overflow-wrap:anywhere] sm:max-w-[85%] ${message.user_id === auth.user.id ? 'bg-primary/15 ml-auto rounded-br-sm' : 'bg-accent/70 mr-auto rounded-bl-sm'}`}
                                >
                                    {(index === 0 ||
                                        new Date(history[index - 1].created_at).toDateString() !== new Date(message.created_at).toDateString()) && (
                                        <p className="text-muted-foreground mb-3 text-xs font-medium">
                                            {new Date(message.created_at).toLocaleDateString('en-PH', { dateStyle: 'long' })}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-semibold">
                                            {message.user_id === auth.user.id ? 'You' : message.author.name}
                                            {message.author.role === 'admin' && (
                                                <span className="text-primary ml-2 text-xs font-medium">LubosMart admin</span>
                                            )}
                                        </p>
                                        <time className="text-muted-foreground text-xs" dateTime={message.created_at}>
                                            {new Date(message.created_at).toLocaleString('en-PH')}
                                        </time>
                                    </div>
                                    <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap">{message.body}</p>
                                    {message.attachment_name && (
                                        <a
                                            href={`/support/${thread.id}/evidence/${message.id}`}
                                            className="text-primary mt-3 inline-flex text-sm font-medium hover:underline"
                                        >
                                            Download {message.attachment_name}
                                        </a>
                                    )}
                                </li>
                            ))}
                            <li ref={end} aria-hidden="true" />
                        </ol>
                    </Card>
                    {embedded ? (
                        <nav aria-label="Message pages" className="flex flex-wrap justify-center gap-2">
                            {messages.links.length > 3 &&
                                messages.links.map((link, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        disabled={!link.url || link.active}
                                        className={secondaryClass}
                                        onClick={() => {
                                            if (link.url) onPageChange?.(link.url);
                                        }}
                                    >
                                        {link.label.replace(/&laquo;|&raquo;/g, '').trim()}
                                    </button>
                                ))}
                        </nav>
                    ) : (
                        <Pager links={messages.links} />
                    )}
                    {thread.status !== 'resolved' ? (
                        <Card>
                            <ValidatedForm
                                noValidate
                                className="grid gap-4"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (form.processing || !form.data.body.trim()) return;
                                    form.post(`/support/${thread.id}/messages`, {
                                        forceFormData: true,
                                        preserveScroll: true,
                                        onSuccess: () => {
                                            form.reset();
                                            onSaved?.();
                                            setFileKey((key) => key + 1);
                                        },
                                    });
                                }}
                            >
                                <Textarea
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                            event.preventDefault();
                                            if (!form.processing && form.data.body.trim()) event.currentTarget.form?.requestSubmit();
                                        }
                                    }}
                                    label="Your reply"
                                    error={form.errors.body}
                                    className="min-h-28 font-normal"
                                    required
                                    placeholder="Write a reply with the next step or update."
                                    maxLength={5000}
                                    value={form.data.body}
                                    onChange={(e) => form.setData('body', e.target.value)}
                                />
                                <p className="text-muted-foreground text-xs">
                                    {form.data.body.length}/5,000 characters. Enter to send, Shift+Enter for a new line
                                </p>

                                <Field
                                    key={fileKey}
                                    label="Evidence (optional, JPG/PNG/PDF, up to 5 MB)"
                                    type="file"
                                    accept="image/jpeg,image/png,application/pdf"
                                    onChange={(e) => form.setData('attachment', e.target.files?.[0] ?? null)}
                                    error={form.errors.attachment}
                                />
                                <button className={`${buttonClass} justify-self-start`} disabled={form.processing || !form.data.body.trim()}>
                                    {form.processing ? 'Sending…' : 'Send Reply'}
                                </button>
                            </ValidatedForm>
                        </Card>
                    ) : (
                        <Card>
                            <p className="text-muted-foreground text-sm">This conversation is resolved. Admin can reopen it if needed.</p>
                        </Card>
                    )}
                </div>
                {admin && (
                    <Card>
                        <h2 className="font-semibold">{thread.kind === 'complaint' ? 'Case Management' : 'Conversation status'}</h2>
                        <ValidatedForm
                            noValidate
                            className="mt-5 grid gap-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                setConfirming(true);
                            }}
                        >
                            <Select label="Status" value={decision.data.status} onChange={(e) => decision.setData('status', e.target.value)}>
                                <option value="open">Open / reopen</option>
                                <option value="in_review">In Review</option>
                                <option value="resolved">Resolved</option>
                            </Select>
                            <Textarea
                                label="Resolution notes"
                                error={decision.errors.resolution}
                                className="min-h-32 font-normal"
                                maxLength={5000}
                                value={decision.data.resolution}
                                onChange={(e) => decision.setData('resolution', e.target.value)}
                            />
                            <p className="text-muted-foreground text-xs">
                                Add an outcome before resolving the case. Notes are shared with participants.
                            </p>
                            <button className={buttonClass} disabled={decision.processing}>
                                Save case status
                            </button>
                        </ValidatedForm>
                    </Card>
                )}
            </div>
            <ReasonConfirmation
                open={confirming}
                onOpenChange={setConfirming}
                title="Confirm case status change?"
                reason={decision.data.resolution}
                onReasonChange={(value) => decision.setData('resolution', value)}
                required={decision.data.status === 'resolved'}
                processing={decision.processing}
                onConfirm={() =>
                    decision.patch(`/support/${thread.id}`, {
                        preserveScroll: true,
                        onSuccess: () => {
                            setConfirming(false);
                            onSaved?.();
                        },
                        onError: () => setConfirming(false),
                    })
                }
            />
        </Container>
    );
}
