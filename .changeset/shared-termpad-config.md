---
'termpad': minor
---

Add shared termpad.json config for team script sharing

- Add support for a `termpad.json` file at the repository root with shared setup, run, and cleanup scripts
- Detects the config file on project open and shows a sync button with badge on the Scripts settings page
- Scripts are never auto-applied; users must explicitly click sync to apply
- Watches the file for changes (e.g., after git pull) and updates the badge
- Fix state corruption when saving full store state with non-serializable Set/Map fields
