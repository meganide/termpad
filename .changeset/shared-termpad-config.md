---
'termpad': minor
---

Add shared termpad.json config for team script sharing

- Add support for a `termpad.json` file at the repository root with shared setup, run, and cleanup scripts
- Auto-applies scripts when a project is first opened with no existing config
- Watches the file for changes and shows a sync button with badge on the Scripts settings page
- User's local script changes always take precedence over the shared config
- Fix state corruption when saving full store state with non-serializable Set/Map fields
