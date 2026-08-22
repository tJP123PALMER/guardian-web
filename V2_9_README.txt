Guardian Operations v2.9 — Message-First MDT

ROOT CAUSE FIXED:
The MDT UI was missing the general NUI handler for open/close/setCallsign/setStatus/
loadIncidents/incident/alert/mobilising. That is why the MDT could show UNSET while
the player-session bar showed J27P6, and Control could create an incident without
the MDT displaying/alarming it.

v2.9:
- Restores the complete MDT NUI ingress.
- Web MDT automatically adopts the single booked callsign.
- Incidents remain real Control incidents internally.
- Player-facing turnout now arrives under MESSAGES like the supplied CF-33 reference.
- Incoming incident -> sound -> mobilisation popup -> Messages -> CF-33 dispatch brief.
- Standby uses exactly the same message-first path.
- Brief shows five-digit no, received time, map ref, to attend, address/postal,
  incident type, risk, further info, assigned units, talkgroup and roles.
- ACK and Set Route are available in the dispatch message.
- Existing v2.7 FiveM dispatch/server logic is deliberately retained.
- Stations, callsigns, booking, standby cover, Return Home and 999 handling retained.
