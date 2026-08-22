Guardian Operations v2.7 — Consolidated Dispatch Fix

This build fixes the regressions together instead of layering another partial patch.

FIXED
- Full station/callsign/appliance configuration retained.
- Fleet no longer disappears if Guardian_control restarts briefly.
- Guardian_web has a built-in station/callsign fallback; existing API key config can stay untouched.
- Guardian_control/server.lua broken literal \n block removed.
- Create Incident uses one canonical incident creation path.
- All new incidents use unique FIVE-DIGIT numeric incident numbers (10000–99999).
- Standby uses a five-digit incident number from the start; UUID is never shown on the MDT.
- Standby is created as a real Guardian_control incident and appears in Incident tabs.
- Standby assignment uses the normal MDT/Turnout/Pager mobilisation route.
- Talkgroup, map ref, special risk, roles and further information are carried to MDT.
- MDT incident list updates same-ID jobs instead of creating duplicates.
- Return Home updates the existing standby job and alerts the MDT.
- Home Station / Mobile And Available closes standby.
- Real incident mobilisation supersedes standby.
- MDT turnout panel now has a forced visible vertical scrollbar.
- ACK / route / clear actions remain reachable at the bottom.
- Duplicate 999 protections and web booking fixes remain.

IMPORTANT INSTALL RULE
Keep your existing guardian_web/shared/config.lua so the Render API key remains unchanged.

Recommended FiveM files to replace from fivem_current_patched:
- Guardian_control/server.lua
- Guardian_control/config.lua
- guardian_web/server/main.lua
- Guardian_mdt/client.lua
- Guardian_mdt/html/ui.js
- Guardian_mdt/html/ui.css

Do NOT overwrite guardian_web/shared/config.lua.
