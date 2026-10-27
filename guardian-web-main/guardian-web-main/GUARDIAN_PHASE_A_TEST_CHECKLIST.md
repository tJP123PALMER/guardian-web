# Phase A test checklist

- [ ] Confirm Discord bot token is configured in Render and Discord integration is enabled.
- [ ] Submit a test application with a numeric Discord user ID (Developer Mode → Copy User ID) or `<@USER_ID>` mention.
- [ ] Approve application; verify the ID appears in Users & Access → Member Directory.
- [ ] Assign a test member to a patrol; verify the assignment API returns `discordDm.sent: true` or a useful failure reason.
- [ ] Check member DM includes patrol, department, division, rank, role, callsign and vehicle.
- [ ] Check assignment `dmStatus` and `dmError` when the DM cannot be sent.
- [ ] Click Attending / Not Attending on the existing Discord patrol post and verify the message and Guardian booking state update.
- [ ] Verify the FiveM announcement receiver and actual in-game delivery separately; this package does not prove that integration works live.
