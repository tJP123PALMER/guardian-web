Guardian MDT — Browser Live Preview
=================================

This is a development-only browser preview of the FiveM NUI.

1. Open the Guardian_mdt/html folder in VS Code.
2. Install the "Live Server" extension.
3. Right-click preview.html.
4. Choose "Open with Live Server".

Edit ui.html, ui.css, or ui.js and save. Live Server will refresh the browser.

The original FiveM files are preserved. preview.html loads the original ui.html structure,
ui.css, and ui.js, while preview.js provides a fake FiveM NUI bridge and demo data.

Preview toolbar:
- + Incident: adds a test incident
- + Message: adds a test Control message
- Mobilising: shows the mobilising overlay
- Reset: reloads the preview

Important:
This preview is for UI development. Real FiveM callbacks, server events, permissions,
and live game data are mocked and will only work normally inside FiveM.
