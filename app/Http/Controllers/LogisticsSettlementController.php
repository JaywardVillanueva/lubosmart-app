<?php

namespace App\Http\Controllers;

use App\Models\LogisticsRemittance;
use App\Models\SellerOrder;
use App\Models\Store;
use App\Services\Admin\AuditLogger;
use App\Services\ParcelFinance;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class LogisticsSettlementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        abort_unless($user->canAdmin('finance') || $user->role === 'logistics', 403);
        $request->validate(['page' => 'sometimes|integer|min:1']);
        // Derive allocations from the original snapshots, never fabricate cash receipts.
        $query = DB::table('seller_orders as parcels')->join('deliveries', 'deliveries.seller_order_id', '=', 'parcels.id')
            ->join('logistics_centers as centers', 'centers.id', '=', 'deliveries.logistics_center_id')
            ->leftJoin('cod_collections as cash', 'cash.delivery_id', '=', 'deliveries.id')
            ->leftJoin('parcel_returns as returns', 'returns.seller_order_id', '=', 'parcels.id')
            ->leftJoin('logistics_remittances as remittance', 'remittance.seller_order_id', '=', 'parcels.id')
            ->when($user->role === 'logistics', fn ($q) => $q->whereIn('centers.id', $user->logisticsCenters()->operational()->select('logistics_centers.id')))
            ->where('parcels.status', 'completed')->where('deliveries.status', 'delivered');
        $reconciled = "cash.status = 'reconciled' AND cash.discrepancy_reason IS NULL AND ROUND(cash.amount * 100) = ROUND(parcels.subtotal * 100) + ROUND(parcels.shipping_fee * 100) AND ROUND(cash.received_amount * 100) = ROUND(parcels.subtotal * 100) + ROUND(parcels.shipping_fee * 100)";
        $totals = (clone $query)->selectRaw("COALESCE(SUM(ROUND(parcels.shipping_fee * 100)), 0) as allocated_cents,
            COALESCE(SUM(CASE WHEN $reconciled THEN ROUND(parcels.shipping_fee * 100) ELSE 0 END), 0) as reconciled_cents,
            COALESCE(SUM(returns.shipping_refund_cents), 0) as shipping_refund_cents,
            COALESCE(SUM(CASE WHEN remittance.id IS NOT NULL THEN ROUND(parcels.shipping_fee * 100) ELSE 0 END), 0) as retained_cents,
            COALESCE(SUM(remittance.amount_cents), 0) as product_remittances_cents")->first();
        $totals = array_map('intval', (array) $totals);
        $totals['pending_cents'] = $totals['allocated_cents'] - $totals['reconciled_cents'];
        // A refund is not automatically an established Logistics liability.
        $totals['awaiting_retention_confirmation_cents'] = $totals['allocated_cents'] - $totals['retained_cents'];
        $entries = $query->orderByDesc('parcels.id')->paginate(15, [
            'parcels.id', 'parcels.subtotal', 'parcels.shipping_fee', 'parcels.status as parcel_status',
            'centers.id as logistics_center_id', 'centers.name as logistics_name', 'deliveries.tracking_reference',
            'deliveries.status as delivery_status', 'cash.status as cash_status', 'cash.amount', 'cash.received_amount',
            'cash.discrepancy_reason', 'returns.shipping_refund_cents',
            'remittance.id as remittance_id', 'remittance.amount_cents as remitted_cents', 'remittance.reference', 'remittance.received_on',
        ])->through(function ($row) {
            $parcel = new SellerOrder(['subtotal' => $row->subtotal, 'shipping_fee' => $row->shipping_fee]);
            $expected = ParcelFinance::expected($parcel);
            $cashMatches = $row->cash_status === 'reconciled' && $row->received_amount !== null
                && empty($row->discrepancy_reason) && ParcelFinance::cents((string) $row->amount) === $expected
                && ParcelFinance::cents((string) $row->received_amount) === $expected;

            return ['parcel_id' => $row->id, 'logistics_center_id' => $row->logistics_center_id,
                'logistics_name' => $row->logistics_name, 'tracking_reference' => $row->tracking_reference,
                'allocation_cents' => ParcelFinance::cents((string) $row->shipping_fee),
                'product_remittance_cents' => ParcelFinance::cents((string) $row->subtotal),
                'remittance' => $row->remittance_id ? ['amount_cents' => (int) $row->remitted_cents, 'reference' => $row->reference, 'received_on' => $row->received_on] : null,
                'can_record' => $cashMatches && ! $row->remittance_id,
                'shipping_refund_cents' => $row->shipping_refund_cents === null ? null : (int) $row->shipping_refund_cents,
                'status' => $cashMatches ? 'cod_reconciled' : 'awaiting_cod_reconciliation'];
        });
        $props = ['entries' => $entries, 'totals' => $totals, 'cash_model' => 'logistics_retains_shipping', 'can_record' => $user->canAdmin('finance')];

        return $request->routeIs('api.v1.*') ? response()->json(['data' => $props])
            : Inertia::render('finance/logistics-settlements', $props);
    }

    public function store(Request $request, SellerOrder $parcel, AuditLogger $audit)
    {
        abort_unless($request->user()->canAdmin('finance'), 403);
        $data = $request->validate(['amount' => 'required|numeric|decimal:0,2|min:0.01|max:99999999.99',
            'reference' => 'required|string|min:3|max:100', 'received_on' => 'required|date_format:Y-m-d|before_or_equal:'.now('Asia/Manila')->toDateString(),
            'notes' => 'required|string|min:3|max:500']);
        try {
            DB::transaction(function () use ($request, $parcel, $data, $audit) {
                Store::query()->whereKey($parcel->store_id)->lockForUpdate()->firstOrFail();
                $parcel = SellerOrder::query()->whereKey($parcel->id)->lockForUpdate()->firstOrFail();
                $delivery = $parcel->delivery;
                $cash = DB::table('cod_collections')->where('delivery_id', $delivery?->id)->lockForUpdate()->first();
                abort_unless(ParcelFinance::reconciled($parcel, $cash) && $delivery->logistics_center_id, 409, 'Full Rider cash receipt and Admin COD reconciliation are required first.');
                abort_if($parcel->logisticsRemittance()->exists(), 409, 'This parcel remittance is already recorded.');
                $expected = ParcelFinance::cents($parcel->subtotal);
                if (ParcelFinance::cents((string) $data['amount']) !== $expected) {
                    throw ValidationException::withMessages(['amount' => 'Record exactly the original net product subtotal. Logistics retains the shipping fee.']);
                }
                $entry = LogisticsRemittance::query()->create(['seller_order_id' => $parcel->id, 'logistics_center_id' => $delivery->logistics_center_id,
                    'recorded_by' => $request->user()->id, 'amount_cents' => $expected, 'reference' => $data['reference'], 'received_on' => $data['received_on'], 'notes' => $data['notes']]);
                $audit->record(['actor_id' => $request->user()->id, 'subject_type' => 'seller_order', 'subject_id' => $parcel->id,
                    'action' => 'logistics_remittance_received', 'changes' => ['remittance_id' => $entry->id, 'amount_cents' => $expected,
                        'shipping_retained_cents' => ParcelFinance::cents($parcel->shipping_fee), 'reference' => $data['reference'], 'reason' => $data['notes'], 'received_on' => $data['received_on']]]);
            }, 3);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['reference' => 'This parcel or remittance reference is already recorded.']);
        }

        return back()->with('status', 'Actual product-cash receipt recorded. Logistics retains shipping. No money transfer was initiated.');
    }
}
