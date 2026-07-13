---
'termpad': patch
---

Improve application responsiveness and resource usage across terminals, Git operations, and repository monitoring. Terminal output and resize work are now batched, terminal rendering uses WebGL when available, expensive Git and shell operations are cached, and polling-based repository refreshes have been replaced with event-driven updates.
