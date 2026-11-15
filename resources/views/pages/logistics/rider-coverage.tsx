import RiderServiceAreaForm from '@/components/logistics/rider-service-area-form';
import { Badge, Card, Empty, Field, Page, Pager, Select, type Pagination } from '@/components/shared/marketplace-ui';
import { Button } from '@/components/ui/button';
import { router } from '@inertiajs/react';
import { MapPin, UserRound } from 'lucide-react';
import { useState } from 'react';

type Option = { id: number; name: string };
type Assignment = {
    rider_id: number;
    rider_name: string;
    area_id: number;
    area_name: string;
    center_name: string;
    is_active: boolean | number;
    barangay_name: string | null;
    city_name: string | null;
    province_name: string | null;
};

export default function RiderCoverage({
    centers,
    riders,
    assignments,
    filters,
}: {
    centers: Option[];
    riders: (Option & { logistics_center_id: number })[];
    assignments: Pagination<Assignment> & { rider_total: number };
    filters: { search?: string; center?: string };
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [center, setCenter] = useState(filters.center ?? '');
    const [loading, setLoading] = useState(false);
    const grouped = new Map<number, Assignment[]>();
    for (const assignment of assignments.data) {
        grouped.set(assignment.rider_id, [...(grouped.get(assignment.rider_id) ?? []), assignment]);
    }
    function filterCoverage(clear = false) {
        if (clear) {
            setSearch('');
            setCenter('');
        }
        router.get('/logistics/rider-coverage', clear ? {} : { search: search.trim(), center }, {
            preserveState: true,
            preserveScroll: true,
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    }
    return (
        <Page title="Rider Coverage" description="Assign destination barangays to your approved riders and review their coverage areas.">
            {centers.length && riders.length ? (
                <RiderServiceAreaForm centers={centers} riders={riders} />
            ) : (
                <Empty
                    title={centers.length ? 'No eligible riders yet' : 'No operational center'}
                    description={
                        centers.length
                            ? 'Approve a rider and verify their email before assigning coverage.'
                            : 'An approved logistics center is required before assigning rider coverage.'
                    }
                />
            )}
            <section aria-label="Existing rider coverage" className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Assigned coverage</h2>
                    <p role="status" className="text-muted-foreground mt-1 text-sm">
                        {assignments.total} coverage {assignments.total === 1 ? 'area' : 'areas'} across {assignments.rider_total}{' '}
                        {assignments.rider_total === 1 ? 'rider' : 'riders'}. Search matches riders and their locations; each card shows the rider’s
                        full coverage.
                    </p>
                </div>
                <form
                    className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
                    aria-label="Filter assigned coverage"
                    aria-busy={loading}
                    onSubmit={(event) => {
                        event.preventDefault();
                        filterCoverage();
                    }}
                >
                    <div className="w-full min-w-0 sm:max-w-sm">
                        <Field
                            label="Search coverage"
                            type="search"
                            reserveFeedback={false}
                            placeholder="Rider, barangay, city or province"
                            maxLength={100}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    {centers.length > 1 && (
                        <div className="w-full sm:w-64">
                            <Select
                                label="Logistics center"
                                reserveFeedback={false}
                                value={center}
                                onChange={(event) => setCenter(event.target.value)}
                            >
                                <option value="">All centers</option>
                                {centers.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    )}
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Searching…' : 'Search'}
                    </Button>
                    {(filters.search || filters.center) && (
                        <Button type="button" variant="outline" disabled={loading} onClick={() => filterCoverage(true)}>
                            Clear filters
                        </Button>
                    )}
                </form>
                {assignments.data.length ? (
                    <div className="grid items-start gap-4 lg:grid-cols-2">
                        {[...grouped].map(([riderId, coverage]) => (
                            <Card key={riderId}>
                                <div className="flex items-start gap-3">
                                    <span className="bg-accent text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                                        <UserRound aria-hidden="true" className="size-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold break-words">{coverage[0].rider_name}</h3>
                                        <p className="text-muted-foreground mt-1 text-sm break-words">
                                            {coverage[0].center_name} · {coverage.length} coverage {coverage.length === 1 ? 'area' : 'areas'}
                                        </p>
                                    </div>
                                </div>
                                <ul className="mt-4 divide-y border-t">
                                    {coverage.map((area) => (
                                        <li key={area.area_id} className="flex flex-wrap items-start gap-3 py-4 last:pb-0">
                                            <MapPin aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium break-words">{area.barangay_name || area.area_name}</p>
                                                <p className="text-muted-foreground mt-1 text-sm break-words">
                                                    {[area.city_name, area.province_name].filter(Boolean).join(', ')}
                                                </p>
                                            </div>
                                            <Badge status={area.is_active ? 'active' : 'inactive'} />
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Empty
                        title={filters.search || filters.center ? 'No matching coverage' : 'No coverage assigned'}
                        description={
                            filters.search || filters.center
                                ? 'Try another rider or location, or clear the filters to see all assigned coverage.'
                                : centers.length && riders.length
                                  ? 'Use the form above to assign a destination barangay to an eligible rider.'
                                  : 'Assignments will appear here when eligible riders receive coverage.'
                        }
                    />
                )}
                <Pager links={assignments.links} />
            </section>
        </Page>
    );
}
