import { Card, money, Page, secondaryClass } from '@/components/shared/marketplace-ui';
import { Link } from '@inertiajs/react';

export default function Finance({
    role,
    amounts,
    discrepancies,
    legacy_rates,
}: {
    role: string;
    amounts: Record<string, number>;
    discrepancies: number;
    legacy_rates: number;
}) {
    return (
        <Page title="Finance overview" description="All-time recorded amounts in PHP, scoped to your authorized transactions.">
            <Card>
                <p className="text-sm leading-relaxed">
                    Delivery recognizes sales allocations. COD reconciliation verifies Rider cash received by Logistics. Platform receipt requires a
                    separately confirmed product remittance. Logistics retains shipping; Rider fees are separate expenses. These figures do not
                    initiate money transfers.
                </p>
                <p className="text-muted-foreground mt-3 text-sm">
                    Cash discrepancies: {discrepancies}. Uncancelled parcels without a historical commission rate: {legacy_rates}. Their expected
                    commission is excluded until reviewed. Historical shipping refunds without a stored split are excluded from the shipping-refund
                    total.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                    {['admin', 'logistics'].includes(role) && (
                        <Link href="/logistics-settlements" className={secondaryClass}>
                            Shipping allocations and remittances
                        </Link>
                    )}
                    {['admin', 'seller'].includes(role) && (
                        <Link href="/settlements" className={secondaryClass}>
                            Seller settlement eligibility
                        </Link>
                    )}
                    {['logistics', 'rider'].includes(role) && (
                        <Link href="/rider-payments" className={secondaryClass}>
                            Rider fees and payments
                        </Link>
                    )}
                    {role === 'seller' && (
                        <Link href="/seller/costs" className={secondaryClass}>
                            Costs and profit
                        </Link>
                    )}
                </div>
            </Card>
            <Card>
                <h2 className="text-lg font-semibold">Recorded financial position</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(amounts).map(([label, cents]) => (
                        <div key={label} className="min-w-0">
                            <dt className="text-muted-foreground text-sm">{label}</dt>
                            <dd className="mt-2 font-semibold tabular-nums">{money(cents / 100)}</dd>
                        </div>
                    ))}
                </dl>
                <p className="text-muted-foreground mt-4 text-sm">
                    Unsettled proceeds are not the amount available for immediate payout. Open returns, cash receipt, remittance evidence and earlier
                    recovery balances can hold a parcel. Expected, recognized and reconciled commission overlap; do not add them together. Recorded
                    profit depends on complete cost entries.
                </p>
            </Card>
        </Page>
    );
}
