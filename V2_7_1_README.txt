Guardian Operations v2.7.1 — CF-33 / Panasonic incident UI only

This build is deliberately based on the pre-Panasonic v2.7 rollback.

CHANGED:
- Only the incident detail renderer and incident CSS.
- Layout now follows the supplied CF-33/Panasonic reference:
  Date/Time Received | Incident | Map Reference
  To Attend, Address, Type, Special Risk, details, Assigned, Talkgrp, Roles
  right-side controls and bottom message controls.
- Incident detail remains scrollable.

NOT CHANGED:
- Guardian_mdt client.lua
- Guardian_mdt server.lua
- Guardian_control dispatch/mobilisation logic
- guardian_web bridge
- incident alert event
- popup event
- alert sound logic
- booking/status/standby/999 logic

The purpose is to preserve the working v2.7 incident delivery path exactly.
