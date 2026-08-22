Guardian Operations v2.9.2 — MDT Browser Fix

Confirmed from screenshots:
- Player Session showed J27P6 booked on.
- The MDT header itself still showed UNSET.
- Guardian Control logged messages and incident dispatch successfully.
- Therefore the browser UI was not binding the booked callsign correctly.
- The UI also had no general handler for type='message', so Control messages
  could never render.

FIXES:
- Booked callsign is written directly into callsignBox as well as via MessageEvent.
- Booking detection accepts authoritative booking records, not only webBooked flags.
- Added the missing normal Control message NUI handler.
- Messages now increment the Messages count and appear in the message list.
- Incidents can now match the booked callsign and populate the message-first turnout UI.
- ui.js and web_bridge.js cache versions bumped to v292 so browsers cannot reuse old JS.
- Misleading `known source=table: ...` log fixed: browser-only bookings correctly show no FiveM source.
- Existing v2.9.1 callsign-addressed FiveM incident/message delivery and Book Off fixes retained.

Install web + matching FiveM resources. Keep guardian_web/shared/config.lua.
