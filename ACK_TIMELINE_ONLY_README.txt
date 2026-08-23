ACK Timeline-Only Fix

Changed:
- Removed AWAITING ACK / ACKNOWLEDGED badges from the mobilisation/pre-flight appliance display.
- Mobilisation rows now show operational information only:
  callsign, station, status, role and action.
- ACK remains persisted on the incident record.
- ACK remains recorded in Incident Timeline as:
    <CALLSIGN> acknowledged incident
- Status changes remain recorded in Incident Timeline.

This package retains the standby editor focus fix, turnout talkgroup/map-ref/etc
payload fix, standby dedupe, incident snapshot merge and status audit fixes.
