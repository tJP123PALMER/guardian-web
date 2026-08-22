Guardian Operations v2.3 Dispatch Upgrade

Key fixes/upgrades:
- Working 999 -> incident conversion (server now understands the UI action).
- 999 call dismiss action and richer call cards.
- Incident action aliases fixed (updateIncidentDetails -> updateIncident).
- Resource request command supported by bridge.
- Standby & Station Cover view with red/amber/green coverage.
- Standby recommendations and one-click operational message to suggested unit.
- No live tracking dependency.
- Existing callsign/station/MDT/incident UI retained.

Install web first, verify /guardian-version, then replace guardian_web bridge only if needed.
