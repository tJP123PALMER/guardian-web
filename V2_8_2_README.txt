Guardian Operations v2.8.2 — Reliable MDT Dispatch

DIAGNOSIS
Status updates prove the MDT->server path works. Mobilisation previously relied on
activeUnits[callsign].source being current. A stale/missing source could assign an
appliance in Control without dispatch:newIncident reaching that player's MDT.

FIX
- Guardian_control broadcasts addressed incident mobilisations to all players.
- Each Guardian_mdt filters by targetCallsign before caching, alerting or opening.
- Only the intended callsign can accept the incident.
- /callsign now requests all currently assigned open incidents.
- Opening the MDT also resyncs assigned incidents.
- Resync populates Active Incidents without replaying the alarm/popup.
- Mobilisation logs now show incident number, callsign and known source.
- Existing status system is unchanged.
- Panasonic UI, ACK route, stations, five-digit numbers, standby, booking and 999 fixes retained.

Install the matched FiveM files from fivem_current_patched.
KEEP guardian_web/shared/config.lua.
