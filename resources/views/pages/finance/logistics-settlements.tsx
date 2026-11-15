import { Card, Empty, money, Page, Pager, type Pagination } from '@/components/shared/marketplace-ui';
import RecordAction from '@/components/shared/record-action';

type Entry = {
    parcel_id: number;
    logistics_name: string;
    tracking_reference: string | null;
    allocation_cents: number;
    shipping_refund_cents: number | null;
    status: 'cod_reconciled' | 'awaiting_cod_reconciliation';
    can_record: boolean;
    product_remittance_cents: number;
    remittance: { amount_cents: number; reference: string; received_on: string } | null;
};

export default function LogisticsSettlements({
    entries,
    totals,
    can_record,
}: {
    entries: Pagination<Entry>;
    totals: {
        allocated_cents: number;
        reconciled_cents: number;
        pending_cents: number;
        shipping_refund_cents: number;
        retained_cents: number;
        product_remittances_cents: number;
    };
    can_record: boolean;
}) {
    return (
        <Page
            title="Logistics shipping allocations"
            description="The assigned Logistics company earns 100% of each delivered parcel’s original shipping fee."
        >
            <Card>
                <h2 className="text-lg font-semibold">Shipping entitlement and cash custody</h2>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                    COD reconciliation confirms cash received by Logistics from its Rider. These allocations do not confirm a remittance to the
                    platform or a payment to Logistics. Logistics retains shipping and remits the net product subtotal to the platform. Admin
                    separately confirms actual receipt. Rider compensation remains in its separate ledger.
                </p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    {[
                        ['Original shipping allocations', totals.allocated_cents],
                        ['Awaiting COD reconciliation', totals.pending_cents],
                        ['COD reconciled allocations', totals.reconciled_cents],
                        ['Recorded shipping refunds', totals.shipping_refund_cents],
                        ['Shipping retained with recorded product remittance', totals.retained_cents],
                        ['Product cash received by platform', totals.product_remittances_cents],
                    ].map(([label, value]) => (
                        <div key={label}>
                            <dt className="text-muted-foreground text-sm">{label}</dt>
                            <dd className="mt-2 font-semibold tabular-nums">{money(Number(value) / 100)}</dd>
                        </div>
                    ))}
                </dl>
                <p className="text-muted-foreground mt-4 text-sm">
                    Shipping refunds are adjustments for review; they do not automatically establish Logistics liability. Historical refunds without
                    an explicit split are not included in that total.
                </p>
            </Card>
            {entries.data.map((entry) => (
                <Card key={entry.parcel_id}>
                    <h2 className="text-lg font-semibold">
                        Parcel #{entry.parcel_id} · {entry.logistics_name}
                    </h2>
                    <p className="text-muted-foreground mt-2 text-sm break-all">Tracking: {entry.tracking_reference ?? 'Not recorded'}</p>
                    <p className="mt-3 tabular-nums">Shipping allocation: {money(entry.allocation_cents / 100)}</p>
                    <p className="mt-2 text-sm">{entry.status === 'cod_reconciled' ? 'COD reconciled' : 'Awaiting full COD reconciliation'}</p>
                    {entry.remittance ? (
                        <p className="mt-2 text-sm break-words tabular-nums">
                            Platform received {money(entry.remittance.amount_cents / 100)} on {entry.remittance.received_on}. Reference:{' '}
                            {entry.remittance.reference}. Logistics retained shipping.
                        </p>
                    ) : (
                        <p className="text-muted-foreground mt-2 text-sm">Product remittance to platform not yet recorded.</p>
                    )}
                    {can_record && entry.can_record && entry.product_remittance_cents > 0 && (
                        <RecordAction
                            forceDialog
                            title="Confirm product remittance receipt"
                            description={`Confirm the platform actually received ${money(entry.product_remittance_cents / 100)} from Logistics. This includes Seller proceeds and commission. Logistics keeps the original shipping allocation. This records evidence; it does not transfer money.`}
                            url={`/logistics-settlements/${entry.parcel_id}`}
                            fields={[
                                {
                                    key: 'amount',
                                    label: 'Actual product cash received (PHP)',
                                    type: 'number',
                                    min: '0.01',
                                    max: '99999999.99',
                                    value: (entry.product_remittance_cents / 100).toFixed(2),
                                },
                                { key: 'reference', label: 'Unique receipt reference', maxLength: 100 },
                                { key: 'received_on', label: 'Actual receipt date (Philippines)', type: 'date' },
                                { key: 'notes', label: 'Receipt evidence and notes', type: 'textarea' },
                            ]}
                        />
                    )}
                    {entry.shipping_refund_cents !== null && (
                        <p className="text-muted-foreground mt-2 text-sm tabular-nums">
                            Recorded shipping refund: {money(entry.shipping_refund_cents / 100)}
                        </p>
                    )}
                </Card>
            ))}
            {!entries.data.length && (
                <Empty
                    title="No delivered shipping allocations"
                    description="Delivered parcels assigned to your company will appear here. No shipping payments have been inferred."
                />
            )}
            <Pager links={entries.links} />
        </Page>
    );
}
