---
'termpad': minor
---

Add an Open ports view to inspect listening TCP ports and manage the processes using them.

- Filter by Termpad, Outside Termpad, or All, with Termpad selected by default and unique process counts on each filter.
- Search by port, process, PID, or address and see CPU averages and resident memory usage, refreshed every five seconds while the view is open.
- Jump to the owning agent or user terminal from a process's actions menu.
- Stop or force-stop a process, with an optional checkbox to close its terminal tab and release saved output.
- Keep the dialog and table layout stable when switching filters.

Support discovery on macOS, Linux, Windows, and running WSL distributions. Recheck process identity before stopping it and protect Termpad's own process.
