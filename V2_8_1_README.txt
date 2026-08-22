Guardian Operations v2.8.1 — MDT Delivery Restore

IMPORTANT
The FiveM incident dispatch path, Guardian_mdt/client.lua, Guardian_control assignment
logic and guardian_web bridge are restored directly from the known-working v2.7 build.

The Panasonic redesign is applied only to the MDT HTML UI.

ACK handling:
- Original dispatch:ackIncident path is retained.
- Guardian_mdt/server.lua mirrors ACK into Guardian_control.
- Guardian_control persists callsign/time and exposes it to web Control.
- No replacement ACK client event is used.

Retained from v2.7:
stations/callsigns, five-digit incident IDs, normal incidents, standby incidents,
return home, create incident, talkgroups/roles, booking and duplicate 999 protection.
