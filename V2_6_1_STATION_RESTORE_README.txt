Guardian Operations v2.6.1 - Station Restore / Resilience Fix

This build keeps all v2.6 turnout/standby features and restores the known fleet/station configuration from the supplied Shockbyte backup.

Fixes:
- Full configured callsign list remains visible in Control.
- Home stations remain available even during a Guardian_control/guardian_web restart race.
- Appliance skills/types remain available.
- Standby Cover no longer collapses the fleet into Unassigned / Command merely because the live snapshot export is temporarily unavailable.
- Preserves the working guardian_web API configuration from the supplied Shockbyte backup.

Install FiveM:
Replace Guardian_999, Guardian_control, Guardian_mdt, Guardian_pager and guardian_web with the folders inside fivem_current_patched.
Do not rename the Guardian_control or guardian_web resource folders.
Restart Guardian_control before guardian_web, or restart the whole server.

Web:
Use the root web files as the Render/GitHub web build, as with v2.6.
