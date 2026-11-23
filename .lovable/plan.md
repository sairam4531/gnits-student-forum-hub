# Cross-device data persistence

## What will change
- Save new event submissions to the shared cloud database instead of treating browser storage or local files as the final save.
- Keep event contact details and file links available only to the administrator; public pages receive event titles and dates.
- Save administrator-managed homepage details and media centrally so edits appear on every device.
- Show a save error when the shared save fails instead of reporting a browser-only save as successful.

## Technical details
- Add the required database grants and access rules for public event submission, safe public event summaries, and administrator-only homepage writes.
- Store homepage media in shared cloud storage; keep event reports and photos in the existing private storage bucket.
- Update the relevant server functions and save flows, then add focused tests and verify a submission can be read back from a fresh browser context.