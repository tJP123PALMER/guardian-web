GUARDIAN OPERATIONS v11.2 RESTORE — WORKING LINK EDITION
========================================================

PURPOSE
Restore the fuller v11.2 Control Centre + Player MDT web interface while keeping
the Render/FiveM API-key connection that is already working.

WEB DEPLOY
Copy the CONTENTS of this folder into your local GuardianWeb Git repository root.
The repository root should contain:
  server.js
  package.json
  package-lock.json
  public\

Then run:
  npm install
  git add .
  git commit -m "Restore Guardian Operations v11.2 interface"
  git push origin main

Render should auto-deploy the pushed commit. If it does not, use Manual Deploy ->
Deploy latest commit.

DO NOT CHANGE IN RENDER
Keep the currently linked GUARDIAN_API_KEY environment group exactly as it is.
If DATABASE_URL is already configured, keep it. If it is not configured, the app
still starts, but PostgreSQL persistence is disabled.

VERIFY AFTER DEPLOY
Open:
  /guardian-version
Expected text:
  Guardian Operations v11.2 ZERO-REDIRECTS

Then open:
  /control/
  /mdt/

There is NO web login redirect layer in this build.

FIVEM IMPORTANT
The folder fivem_restore_reference contains the older v11.2 FiveM files for
reference/restoration later. DO NOT overwrite your currently working FiveM bridge
with those files yet. First verify the restored website while the current bridge
continues to show ONLINE.

SECURITY
No Render API key or password is included in this package. GUARDIAN_API_KEY is
read from Render's environment at runtime.
