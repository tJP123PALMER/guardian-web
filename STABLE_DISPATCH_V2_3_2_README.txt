Guardian Operations v2.3.2 — Stable Dispatch

Polish/fixes in this build:
- duplicate 999 calls removed server-side on every snapshot
- malformed legacy 999 calls without IDs also get exact-content dedupe
- converting a 999 call is idempotent
- double clicks/retries cannot create two incidents from one 999 call
- converted/dismissed 999 calls disappear immediately and remain suppressed while FiveM catches up
- dismiss 999 is optimistic and reliable
- browser keeps conversion/dismiss locks across live rerenders
- accidental duplicate web commands are rejected briefly
- acknowledged command memory is automatically cleaned up
- v2.3.1 web MDT Book On/Book Off persistence fix retained
- station/callsign snapshot support retained
- standby/cover features retained
- no live-tracking feature is required or used

Recommended install:
1. Install/push the web package.
2. Confirm /guardian-version reports v2.3.2.
3. Replace only guardian_web/server/main.lua with the included bridge.
4. KEEP your existing guardian_web/shared/config.lua and API key.
5. restart guardian_web.
