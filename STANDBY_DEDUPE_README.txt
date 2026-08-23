Web MDT standby duplicate fix

Cause:
The web MDT immediately creates a temporary standby turnout for the alert/popup,
then Guardian_control publishes the real numeric incident. The UI keyed messages
by incident ID, so STANDBY:<uuid> and #12345 appeared as two different incidents.

Fix:
- standbyMoveId is now the canonical identity for standby turnouts.
- authoritative incident replaces the temporary turnout.
- incidents[] also merges by standbyMoveId.
- any legacy duplicate for the same standbyMoveId is removed.
- normal incidents are unchanged.
