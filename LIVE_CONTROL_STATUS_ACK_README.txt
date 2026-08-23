Live Control Incident Status + ACK

WEB:
- Assigned pumps now show current live status.
- They show AWAITING ACK until the MDT acknowledges.
- After ACK they show ACK + acknowledgement time.
- A compact live summary is shown above mobilisation rows.
- Status is read from current state.units first, so Home Station / Mobile /
  In Attendance / Available etc. updates with the player.
- 2-second safety refresh added alongside the existing EventSource updates.
- Standby MDT dedupe fix is retained.

FIVEM PATCH REQUIRED FOR ACK:
FIVEM_ACK_SYNC_PATCH/Guardian_control/server.lua
FIVEM_ACK_SYNC_PATCH/Guardian_mdt/server.lua

Why:
The current GuardianWebAckIncident export only emitted a client event and did
not store acknowledgement in the incident. These patched files persist
acknowledgedBy[callsign] and acknowledgedAt[callsign], publish stateDirty, and
make in-game MDT acknowledgements use the same persistent route.
