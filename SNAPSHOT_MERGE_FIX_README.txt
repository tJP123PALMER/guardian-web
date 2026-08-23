Snapshot merge fix

Fixes the regression where ACK/status audit entries briefly appeared and then
vanished when the next FiveM state snapshot arrived.

Changes:
- Incident timelines are merged, never replaced by an empty/newer snapshot.
- acknowledgedBy / acknowledgedAt / applianceStatuses are preserved and merged.
- standby incident records also use the same merge path.
- Appliance Board searches state.incidents AND state.standbyIncidents.
- Incident number and ACK state are always shown for any assigned open incident.
