Guardian Operations v2.3.1 — Web MDT Booking Fix

Problem fixed:
The browser queued webBookOn but the v2 bridge relied on a control:webBookOn
event that older/current Guardian_control builds may not implement. The command
was acknowledged without a booking being retained, then the next heartbeat
reset the web MDT.

v2.3.1:
- mirrors web Book On immediately in the Render state
- FiveM bridge keeps a webBookings overlay
- merges web bookings into every Guardian snapshot
- Book Off removes only the web-only overlay
- web MDT status updates the overlay and is immediately reflected on web Control
- callsign remains locked while booked on
- optional control:webBookOn/webBookOff/webMdtStatus events are still emitted
  for compatibility with newer Guardian_control builds

Install:
1. Web: copy package web files into GuardianWeb, npm install, commit/push.
2. Wait until /guardian-version shows v2.3.1.
3. FiveM: replace guardian_web/server/main.lua with the included
   fivem_guardian_web_v2/server/main.lua.
4. Keep your existing guardian_web/shared/config.lua/API key.
5. restart guardian_web

Test:
- open web MDT
- choose J27P6
- BOOK ON
- button changes to BOOK OFF and selector locks
- J27P6 appears live on web Control
- change status and SEND STATUS
- status persists through several heartbeats
- BOOK OFF removes browser-only booking
