<?php

namespace App\Services;

use App\Models\SellerOrder;
use Illuminate\Database\Eloquent\Builder;
use InvalidArgumentException;

class ParcelFinance
{
    // Existing DECIMAL snapshots remain authoritative; arithmetic uses centavos.
    public static function cents(string|int $amount): int
    {
        if (! preg_match('/^(-?)(\d+)(?:\.(\d{1,2}))?$/D', $amount, $parts)) {
            throw new InvalidArgumentException('Money must have at most two decimal places.');
        }

        $value = (int) $parts[2] * 100 + (int) str_pad($parts[3] ?? '', 2, '0');

        return ($parts[1] ?? '') === '-' ? -$value : $value;
    }

    public static function decimal(int $cents): string
    {
        $absolute = abs($cents);

        return ($cents < 0 ? '-' : '').intdiv($absolute, 100).'.'.str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);
    }

    public static function commission(int $products, int $basisPoints): int
    {
        if ($products < 0 || $basisPoints < 0 || $basisPoints > 10000) {
            throw new InvalidArgumentException('Invalid commission snapshot.');
        }

        return intdiv($products * $basisPoints + 5000, 10000);
    }

    public static function expected(SellerOrder $parcel): int
    {
        return self::cents($parcel->subtotal) + self::cents($parcel->shipping_fee);
    }

    public static function reconciled(SellerOrder $parcel, ?object $cash): bool
    {
        return $parcel->status === 'completed' && $parcel->delivery?->status === 'delivered'
            && $cash && $cash->status === 'reconciled' && $cash->received_amount !== null
            && empty($cash->discrepancy_reason)
            && self::cents((string) $cash->amount) === self::expected($parcel)
            && self::cents((string) $cash->received_amount) === self::expected($parcel);
    }

    public static function reconciledParcels(Builder $query): Builder
    {
        return $query->where('seller_orders.status', 'completed')
            ->whereHas('delivery', fn ($delivery) => $delivery->where('status', 'delivered')
                ->whereExists(fn ($cash) => $cash->selectRaw('1')->from('cod_collections')
                    ->whereColumn('cod_collections.delivery_id', 'deliveries.id')
                    ->where('cod_collections.status', 'reconciled')
                    ->whereNull('cod_collections.discrepancy_reason')
                    ->whereRaw('ROUND(cod_collections.amount * 100) = ROUND(seller_orders.subtotal * 100) + ROUND(seller_orders.shipping_fee * 100)')
                    ->whereRaw('ROUND(cod_collections.received_amount * 100) = ROUND(seller_orders.subtotal * 100) + ROUND(seller_orders.shipping_fee * 100)')));
    }

    public static function funded(SellerOrder $parcel): bool
    {
        $remittance = $parcel->logisticsRemittance;

        return $remittance && $remittance->amount_cents === self::cents($parcel->subtotal)
            && $remittance->logistics_center_id === $parcel->delivery?->logistics_center_id;
    }

    public static function fundedParcels(Builder $query): Builder
    {
        return self::reconciledParcels($query)->whereHas('logisticsRemittance', fn ($remittance) => $remittance
            ->whereRaw('logistics_remittances.amount_cents = ROUND(seller_orders.subtotal * 100)')
            ->whereExists(fn ($delivery) => $delivery->selectRaw('1')->from('deliveries')
                ->whereColumn('deliveries.seller_order_id', 'seller_orders.id')
                ->whereColumn('deliveries.logistics_center_id', 'logistics_remittances.logistics_center_id')));
    }

    public static function refundableProducts(SellerOrder $parcel, int $refund): array
    {
        $subtotal = self::cents($parcel->subtotal);
        $products = min($refund, $subtotal);
        $recognized = self::cents($parcel->commission_amount ?? '0.00');
        $reversal = $subtotal > 0 ? min($recognized, intdiv($products * $recognized + intdiv($subtotal, 2), $subtotal)) : 0;

        return ['product_refund_cents' => $products, 'shipping_refund_cents' => $refund - $products,
            'commission_reversal_cents' => $reversal, 'seller_debit_cents' => $products - $reversal];
    }
}
