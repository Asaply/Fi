// Providers may re-issue a pending movement under a new id once it settles.
// Within the synced range, a pending row the provider no longer returns is stale.
export function stalePendingExternalIds(existing, fetchedIds, { from, to }) {
    const fetched = new Set(fetchedIds);
    return existing
        .filter((r) => r.bank_status === 'pending' && r.date >= from && r.date <= to && !fetched.has(r.external_id))
        .map((r) => r.external_id);
}
