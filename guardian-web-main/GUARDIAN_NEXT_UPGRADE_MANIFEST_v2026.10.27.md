# Guardian Next Upgrade — Operations Centre, Dispatch & FiveM Diagnostics

## Package basis
Built on the supplied Guardian source snapshot and the preceding cumulative upgrade source. This is a source package only; it has not been pushed to GitHub or deployed to Render.

## Added in this upgrade
- Added an **Operations Centre** admin tab with operational KPIs, Guardian core connection state, configuration warning count, and patrol overview.
- Added a **Dispatch & Control** admin tab that reads the current Guardian `/api/state` snapshot and displays the incidents and 999 queue in read-only tables.
- Added a **FiveM Integration** admin tab that checks `/healthz`, `/api/state`, and the existing `/api/admin/game-server/status` endpoint; reports bridge URL/token configuration presence without revealing secrets; and links to announcements for an end-to-end test.
- Added navigation wiring and cache-busted the settings CSS reference to v61.
- Retained the existing patrol, Discord, applications, announcements, and FiveM command/receiver routes from the source snapshot.

## Validation performed
- `node --check server.js` passed.
- `node --check public/settings.js` passed.
- UI/API integration has not been browser-tested against a live Render deployment in this environment.
- Live Discord delivery and in-game FiveM announcement display have not been verified.

## Important limitations
- Dispatch & Control is a read-only view of the current state payload; it does not replace the existing MDT or add new dispatch mutation endpoints.
- FiveM diagnostics confirm configuration and current heartbeat signals only. Actual announcement delivery requires the compatible FiveM receiver resource running on Shockbyte and matching endpoint/token configuration.
- This package does not claim to be the final all-features release; it is the next incremental upgrade and preserves the rest of the existing project.

## Deployment
1. Back up the current repository and persistent data.
2. Extract this package and review the changes against your live branch.
3. Preserve Render environment variables and persistent storage.
4. Deploy to a staging service if available, then check `/healthz`, the new admin tabs, Discord patrol assignment status, and a test FiveM announcement.
