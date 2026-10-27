GUARDIAN APPLICATIONS + DISCLAIMER UPDATE
==========================================

Files changed:
- server.js
- public/apply/index.html

Features:
- New application templates: Community/Whitelist, Fire & Rescue, Police,
  SAS/Specialist Operations, Staff Team, Developer/Technical Team, and
  Department/Management.
- The form changes questions based on the selected application type.
- Submissions are validated on the server; each required answer and both
  rules/disclaimer confirmations are required.
- The application record stores applicationType, applicationLabel, question/answer
  pairs, disclaimerAccepted and disclaimerVersion.
- A clear roleplay disclaimer is shown on the application page and can be
  overridden using guardianConfig.portal.disclaimerText.
- Existing staff application review route is retained.

Upload to GitHub:
1. Back up your current repository and its persistent data.
2. Extract this ZIP and copy the changed files/folders into your repo, keeping the
   same paths. Or upload the included PATCH_FILES folder's files individually.
3. Commit and push, then restart/redeploy the server.
4. Test one application of each type and check /api/admin/applications as an admin.

Compatibility:
- Existing stored applications are not deleted. Older applications may have answers
  as strings; new submissions store answers as {question, answer} objects.
- Keep the existing data directory and configure persistent storage/backups.
- This is a fictional roleplay application system, not real emergency service recruitment.
