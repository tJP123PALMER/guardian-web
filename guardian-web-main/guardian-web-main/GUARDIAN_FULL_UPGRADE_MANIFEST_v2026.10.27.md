# Guardian Full Upgrade — 2026.10.27

## Based on
The supplied `guardian-web-main (4).zip` project snapshot. This is a cumulative source package; it has not been pushed to GitHub or deployed to Render.

## Changes made in this package
- Duty assignment endpoint now attempts a direct message using the configured Discord bot token and the member's numeric Discord user ID.
- Assignment DM outcomes (`sent`, `failed`, or `skipped`) are persisted on the deployment record and included in the API response, with a diagnostic error when available.
- Assignment DM includes patrol, department, division, rank, role, callsign, vehicle, and radio talkgroup.
- Application submission extracts a numeric Discord user ID when the provided Discord field contains one and stores it on both application and member records.
- Application approval carries the saved numeric Discord ID into the member profile if the profile does not already have one.
- Patrol Discord embeds list both attending and not-attending members.

## Checks performed
- `node --check server.js` passed.
- `node --check public/settings.js` passed.

## Not yet verified
- No live Discord DM has been sent from this package. Test in Render after deploying to verify token, integration enabled state, member ID, and DM privacy.
- Discord OAuth linking is not implemented by this change; only numeric IDs included in the existing application field are extracted.
- Full new Operations Centre, Dispatch & Control, Events & Training, Incident Reports, and FiveM Integration UI tabs have not been implemented in this package. Existing system modules and APIs are retained; these UI additions remain follow-on work rather than falsely being marked complete.
- FiveM delivery depends on a working receiver resource and configuration on the game server.

## Deploy safely
1. Back up the current repository and persistent data.
2. Review the diff against your live repository before merging.
3. Preserve Render environment variables and persistent storage.
4. Deploy to a test/staging service first if available.
5. Assign a test member with a valid numeric Discord ID and inspect the API response and Render logs.
