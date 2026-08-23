Guardian Web ACK + In-Game Incident Number Fix

WEB ACK
- Added the missing control:webMdtAck handler in Guardian_control.
- Added control:ackStandbyMove ACK persistence.
- Browser MDT ACK now writes acknowledgedBy / acknowledgedAt to the same
  authoritative incident record used by Control.
- Incident Timeline receives:
    <CALLSIGN> acknowledged incident
- State is republished to Guardian Web immediately.

IN-GAME ACK
- dispatch:ackIncident now uses the same persistent Guardian_control ACK route.

INCIDENT NUMBER IN STATUS BAR
- FiveM MDT uses the same status header logic as browser MDT.
- Example:
    Mobile to Incident · #13902
    In Attendance at Incident · #13902
    Available At Incident · #13902
- Pressing Send Status no longer overwrites the header with plain status text.
- The number is taken from the authoritative Control incident ID, not generated
  separately by the MDT.

INSTALL
Web:
  deploy this package over GuardianWebClean as normal.

FiveM:
  use FIVEM_ACK_SYNC_PATCH/Guardian_control/server.lua
  use FIVEM_ACK_SYNC_PATCH/Guardian_mdt/server.lua

For the in-game incident-number display, also replace the full Guardian_mdt
resource using:
  fivem_current_patched/Guardian_mdt
or at minimum:
  fivem_current_patched/Guardian_mdt/html/ui.js
  fivem_current_patched/Guardian_mdt/html/ui.html
