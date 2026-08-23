Guardian FULL in-game <-> web sync restore

Restores the previously working shared callsign sync.

CONTROL -> MDT
- Incident mobilisation is callsign-addressed and broadcast.
- Signed-on in-game MDT accepts only incidents for its callsign.
- Web MDT continues to receive the same incident from shared state.

IN-GAME MDT -> WEB CONTROL / WEB MDT
- In-game callsign registration refreshes player source mapping.
- In-game status changes update Guardian_control incident/unit state.
- Guardian web state is immediately marked dirty and republished.
- Same-callsign sessions receive mirrored status updates.

WEB MDT -> IN-GAME / CONTROL
- Web status uses Guardian_control authoritative status export.
- Web ACK is routed into Guardian_control.
- Same persisted ACK is republished to Control and same-callsign MDT sessions.

ACK
- Game and browser use the same incident acknowledgement record.
- Incident Timeline receives '<CALLSIGN> acknowledged incident'.

Also fixes the BroadcastOngoingIncidents nil crash with a forward declaration.

INSTALL ALL THREE MATCHED FIVEM RESOURCES:
- Guardian_control
- Guardian_mdt
- guardian_web

Keep your existing guardian_web/shared/config.lua.
Deploy the web root from this package as normal.
