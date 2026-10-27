# Guardian IRL Vehicle build changes

- Existing FiveM and `/control/` routes preserved.
- `/vehicle/` is the Android head-unit entry point and requires Guardian login.
- Vehicle callsign is assigned by Control to username; no vehicle callsign picker.
- Vehicle MDT commands include `X-Guardian-Vehicle: 1`; server overwrites callsign with the authorised assignment and rejects unassigned sessions.
- Control gets a Vehicle MDT Assignments panel.
- Vehicle CSS fixes the app to the viewport; the whole page does not scroll. Only contained content panels may scroll when necessary.
- Android WebView blocks same-host navigation outside vehicle/login/MDT/API paths.
- Existing launcher icon is retained until the final Guardian logo asset is supplied.

Before real-world deployment, add authentication/authorisation to the wider existing Control API. The legacy Control surface currently follows the project's pre-existing trust model.
