Guardian Live Operations v2

This build keeps the restored Control + MDT interface and adds:
- authoritative shared state endpoints
- callsigns + station grouping
- appliance skill metadata
- booking state support
- 999 queue support
- command ACKs
- live tracking endpoint
- event history
- stale-link heartbeat handling
- expanded command set

FiveM:
Use fivem_guardian_web_v2 as the guardian_web resource, but put the exact Render
GUARDIAN_API_KEY into shared/config.lua first.

Future tracking:
POST /api/fivem/tracking with callsign/x/y/z/heading/speed/status/incidentId.
