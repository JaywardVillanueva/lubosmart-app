<?php

namespace App\Http\Controllers;

use App\Services\ParcelFinance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class FinanceController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        abort_unless($user->canAdmin('finance') || in_array($user->role, ['seller', 'logistics', 'rider'], true), 403);
        $rows = DB::table('seller_orders as parcels')->leftJoin('deliveries', 'deliveries.seller_order_id', '=', 'parcels.id')
            ->leftJoin('cod_collections as cash', 'cash.delivery_id', '=', 'deliveries.id')
            ->leftJoin('parcel_returns as returns', 'returns.seller_order_id', '=', 'parcels.id')
            ->leftJoin('seller_payouts as payout', 'payout.seller_order_id', '=', 'parcels.id')
            ->leftJoin('logistics_remittances as remittance', 'remittance.seller_order_id', '=', 'parcels.id')
            ->when($user->role === 'seller', fn ($q) => $q->where('parcels.store_id', $user->store?->id ?? 0))
            ->when($user->role === 'logistics', fn ($q) => $q->whereIn('deliveries.logistics_center_id', $user->logisticsCenters()->operational()->select('logistics_centers.id')))
            ->when($user->role === 'rider', fn ($q) => $q->where('cash.rider_id', $user->id))
            ->select(['parcels.id', 'parcels.store_id', 'parcels.subtotal', 'parcels.discount_amount', 'parcels.shipping_fee', 'parcels.commission_basis_points',
                'parcels.commission_amount', 'parcels.seller_proceeds', 'parcels.status', 'deliveries.status as delivery_status',
                'cash.amount', 'cash.received_amount', 'cash.status as cash_status', 'cash.discrepancy_reason',
                'returns.status as return_status', 'returns.refund_cents', 'returns.seller_debit_cents', 'returns.commission_reversal_cents',
                'returns.shipping_refund_cents', 'payout.amount_cents as payout_cents', 'remittance.amount_cents as remittance_cents'])
            ->orderBy('parcels.id')->cursor();
        $amounts = array_fill_keys(['COD collected', 'Cash received by Logistics', 'Awaiting Logistics cash receipt', 'Awaiting Admin reconciliation', 'COD reconciled',
            'Shipping allocations', 'Gross product sales', 'Seller voucher discounts', 'Net product sales', 'Expected commission',
            'Recognized commission', 'Reconciled commission', 'Commission backed by platform cash receipt', 'Commission reversals',
            'Seller proceeds', 'Seller refund deductions', 'Manual seller payouts', 'Manual buyer refunds', 'Shipping refunds'], 0);
        $discrepancies = 0;
        $legacyRates = 0;
        $storeBalances = [];
        foreach ($rows as $row) {
            $subtotal = ParcelFinance::cents((string) $row->subtotal);
            $shipping = ParcelFinance::cents((string) $row->shipping_fee);
            $completed = $row->status === 'completed' && $row->delivery_status === 'delivered';
            $reconciled = $completed && $row->cash_status === 'reconciled' && $row->received_amount !== null && empty($row->discrepancy_reason)
                && ParcelFinance::cents((string) $row->amount) === $subtotal + $shipping
                && ParcelFinance::cents((string) $row->received_amount) === $subtotal + $shipping;
            if ($row->status !== 'cancelled') {
                if ($row->commission_basis_points === null) {
                    $legacyRates++;
                } else {
                    $amounts['Expected commission'] += ParcelFinance::commission($subtotal, (int) $row->commission_basis_points);
                }
            }
            if ($row->amount !== null) {
                $cash = ParcelFinance::cents((string) $row->amount);
                $received = $row->received_amount === null ? 0 : ParcelFinance::cents((string) $row->received_amount);
                $amounts['COD collected'] += $cash;
                $amounts['Cash received by Logistics'] += $received;
                $amounts['Awaiting Logistics cash receipt'] += max(0, $cash - $received);
                if (! $reconciled) {
                    $amounts['Awaiting Admin reconciliation'] += $cash;
                }
                if ($row->discrepancy_reason || $cash !== $subtotal + $shipping || ($row->received_amount !== null && $cash !== $received)) {
                    $discrepancies++;
                }
                if ($reconciled) {
                    $amounts['COD reconciled'] += $cash;
                }
            }
            if ($completed) {
                $discount = ParcelFinance::cents((string) $row->discount_amount);
                $commission = ParcelFinance::cents((string) ($row->commission_amount ?? '0.00'));
                $amounts['Gross product sales'] += $subtotal + $discount;
                $amounts['Seller voucher discounts'] += $discount;
                $amounts['Net product sales'] += $subtotal;
                $amounts['Shipping allocations'] += $shipping;
                $amounts['Recognized commission'] += $commission;
                $amounts['Seller proceeds'] += ParcelFinance::cents((string) ($row->seller_proceeds ?? '0.00'));
                $amounts['Reconciled commission'] += $reconciled ? $commission : 0;
                $amounts['Commission backed by platform cash receipt'] += $row->remittance_cents !== null && (int) $row->remittance_cents === $subtotal ? $commission : 0;
            }
            $amounts['Commission reversals'] += (int) $row->commission_reversal_cents;
            $amounts['Seller refund deductions'] += (int) $row->seller_debit_cents;
            $amounts['Manual seller payouts'] += (int) $row->payout_cents;
            $amounts['Manual buyer refunds'] += (int) $row->refund_cents;
            $amounts['Shipping refunds'] += (int) $row->shipping_refund_cents;
            $storeBalances[$row->store_id] = ($storeBalances[$row->store_id] ?? 0)
                + ($completed ? ParcelFinance::cents((string) ($row->seller_proceeds ?? '0.00')) : 0)
                - (int) $row->seller_debit_cents - (int) $row->payout_cents;
        }
        $amounts['Unsettled seller balance'] = $amounts['Seller proceeds'] - $amounts['Seller refund deductions'] - $amounts['Manual seller payouts'];
        $amounts['Seller recovery balance'] = array_sum(array_map(fn ($balance) => max(0, -$balance), $storeBalances));
        $amounts['Seller payable balances before payout holds'] = array_sum(array_map(fn ($balance) => max(0, $balance), $storeBalances));
        if (in_array($user->role, ['logistics', 'rider'], true)) {
            $amounts = array_intersect_key($amounts, array_flip(['COD collected', 'Cash received by Logistics', 'Awaiting Logistics cash receipt', 'Awaiting Admin reconciliation', 'COD reconciled', 'Shipping allocations']));
            if ($user->role === 'rider') {
                unset($amounts['Shipping allocations']);
            }
            $fees = DB::table('rider_payments')->when($user->role === 'rider', fn ($q) => $q->where('rider_id', $user->id),
                fn ($q) => $q->whereIn('logistics_center_id', $user->logisticsCenters()->operational()->select('logistics_centers.id')));
            $amounts['Rider fees earned'] = (int) (clone $fees)->sum('amount_cents');
            $amounts['Rider fees paid'] = (int) (clone $fees)->whereNotNull('paid_at')->sum('amount_cents');
            $amounts['Rider fees outstanding'] = $amounts['Rider fees earned'] - $amounts['Rider fees paid'];
        }
        if ($user->role === 'seller') {
            $amounts['Recorded operating costs'] = (int) DB::table('seller_costs')->where('store_id', $user->store?->id ?? 0)->whereNull('voided_at')->sum('amount_cents');
            $amounts['Estimated profit after recorded costs'] = $amounts['Seller proceeds'] - $amounts['Seller refund deductions'] - $amounts['Recorded operating costs'];
        }
        $props = ['role' => $user->role, 'amounts' => $amounts, 'discrepancies' => $discrepancies, 'legacy_rates' => $legacyRates];

        return $request->routeIs('api.v1.*') ? response()->json(['data' => $props]) : Inertia::render('finance/overview', $props);
    }
}
