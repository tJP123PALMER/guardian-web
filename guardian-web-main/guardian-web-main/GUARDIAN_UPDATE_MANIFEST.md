# Guardian Phase A Update — 2026.10.27

Version: `2026.10.27-phase-a-core-fixes.1`
Base: supplied Guardian website source snapshot.

## Included in this package
- Patrol duty assignment attempts to DM the assigned member through the configured Discord bot. Assignment records retain `dmStatus` and `dmError`; API response reports delivery outcome.
- Numeric Discord user IDs and standard Discord mentions entered in the application field are carried into the new Guardian user profile.
- On approval, legacy applications are checked and a numeric Discord ID is backfilled into the user profile when available.
- Existing patrol Discord attendance components and message-sync logic are retained from the source snapshot.

## Important limitations
- A Discord username alone cannot reliably identify a Discord account ID. For automatic linking, applicants must enter their numeric user ID (or a Discord mention) until OAuth account linking is implemented.
- Discord DMs require `DISCORD_BOT_TOKEN`, the Discord integration enabled, a valid linked numeric user ID, and the member's privacy settings to allow the bot to message them. Failed DMs are reported, not guaranteed delivered.
- This package does not claim to add every proposed Operations Centre / Dispatch / Events / Incident Reports / FiveM Integration screen. Those are subsequent Phase A interface work and should not be represented as already delivered.
- No live Discord, Render, database migration or FiveM test was performed.

## Deployment
1. Back up the live repository and persistent data.
2. Compare/merge `server.js` into the current GitHub project rather than blindly overwriting unrelated newer work.
3. Run `node --check server.js`, then deploy through GitHub/Render.
4. Test with a linked test account: submit application with numeric Discord ID, approve, verify ID in Member Directory, assign duty, and verify the DM status.
5. Verify existing patrol attendance buttons and FiveM integration separately before declaring the release complete.

## Source checks
- `node --check server.js`: pass.
- `node --check public/settings.js`: pass (unchanged).
