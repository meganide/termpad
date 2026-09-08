---
'termpad': patch
---

Add agent overview shortcuts: Cmd+O to toggle the overview, Cmd+I to open the overview for the current repository, Cmd+Arrow keys to select visible agents, Cmd+Shift+Enter to open the selected agent in its worktree, and Cmd+- to close it with the existing running-terminal confirmation. Use Ctrl on Windows and Linux.

Register global keyboard shortcuts once so returning from the overview to a worktree does not cause another listener to swallow the repository overview shortcut.
