---
'termpad': minor
---

feat: separate global notes and todos from worktree content

The primary checkout shows repository-wide Global notes and todos, while each linked worktree shows only its own content. Existing primary-checkout content is preserved in the global scope. Tab indicators reflect only the current scope, with completed/total todo counts and an indicator for saved notes. Todo actions are available from a dropdown or right-click menu, including moving a global todo to another worktree.
