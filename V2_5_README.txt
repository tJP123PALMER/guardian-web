Guardian Operations v2.5 — Standby-as-Incident

Standby now creates a special STANDBY COVER incident and dispatches it using the
normal createIncident + assignAppliance command path.

Expected behaviour:
- standby appears in Control Incidents
- same normal MDT incident delivery path is used
- MDT / Turnout / Pager channel data is present (MDT+Turnout on by default)
- standby statuses remain Mobile to Standby Station / Available Standby Station
- those standby statuses stay mobilisable for real incidents
- real incident assignment automatically supersedes/closes the standby incident
- standby records are category=standby / isStandby=true so emergency stats can exclude them
- home station and current standby cover remain visible on the resource board

Retains v2.4.3 resource-board, v2.4.2 selection persistence, Book Off fix,
and duplicate-999 protections.
