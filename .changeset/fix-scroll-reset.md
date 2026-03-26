---
'termpad': patch
---

Fix terminal scroll position jumping to top during resize/reflow

When xterm.js reflows content (e.g., due to a container resize triggering `fitAddon.fit()`), the viewport scroll position could reset to line 0. This caused the terminal to jump to the top when the user had scrolled up, particularly noticeable when Claude Code was producing lots of output. The scroll position is now saved before fit and restored afterward, preserving the user's scroll position.
