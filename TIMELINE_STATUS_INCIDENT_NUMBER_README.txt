Guardian timeline + status incident-number fix

INCIDENT TIMELINE
- MDT acknowledgement persists into incidentHistory.
- Timeline gets: '<CALLSIGN> acknowledged incident'
- Appliance status changes get timeline entries:
  '<CALLSIGN> status changed to Mobile to Incident'
  '<CALLSIGN> status changed to In Attendance at Incident'
  '<CALLSIGN> status changed to Available at Incident'
- Duplicate repeated status/ACK events are not added.

MDT STATUS HEADER
- Incident-related statuses show the SAME authoritative 5-digit incident number:
  Mobile to Incident · #58164
  In Attendance at Incident · #58164
  Available at Incident · #58164
- Number comes from incident.incidentNumber / incident.id received from Control.
- No separate MDT incident number is generated.
- Non-incident statuses show normally without a number.

INSTALL:
- Web files are the full web package.
- For FiveM, use the included FIVEM_ACK_SYNC_PATCH server.lua files.
