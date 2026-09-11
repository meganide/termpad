# termpad

## 0.11.0

### Minor Changes

- [#45](https://github.com/meganide/termpad/pull/45) [`d09a7ba`](https://github.com/meganide/termpad/commit/d09a7bacbb3c46d0a4fbfeb10e6fe9bd2e096118) Thanks [@meganide](https://github.com/meganide)! - Add a Move to action to todo menus for moving todos between Global and worktrees within a repository while preserving their status and details. Keep todo card labels, dates, and menu buttons aligned when opening menus or editing.

### Patch Changes

- [#43](https://github.com/meganide/termpad/pull/43) [`6c78d93`](https://github.com/meganide/termpad/commit/6c78d932d6e9d7b46cc2fcd6e8c110ebe74c85fc) Thanks [@meganide](https://github.com/meganide)! - Rename the Global scope to All in notes and todos headings, Planning's scope selector, and tab tooltips.

- [#46](https://github.com/meganide/termpad/pull/46) [`bf53f8e`](https://github.com/meganide/termpad/commit/bf53f8e817e6ed629855b870b13cec6ccb21bb7b) Thanks [@meganide](https://github.com/meganide)! - Fix duplicate worktree entries in the sidebar when worktree creation overlaps with automatic discovery. Reuse the existing session so terminals stay attached to the correct worktree.

## 0.10.0

### Minor Changes

- [#41](https://github.com/meganide/termpad/pull/41) [`4a1d6bd`](https://github.com/meganide/termpad/commit/4a1d6bdc9905f73cf3268401f6d1349bd67ae38d) Thanks [@meganide](https://github.com/meganide)! - Add a repository Planning workspace for managing todos and notes across global and worktree scopes. The global board includes todos from every worktree, and starting a todo in a new or existing worktree launches work without leaving Planning or losing your scroll position and drafts.

  Open Planning from repository menus or Todos and Notes panels with the matching scope selected, and click a todo's worktree label to navigate to that worktree. Global and worktree section titles now keep their content always visible.

## 0.9.0

### Minor Changes

- [#35](https://github.com/meganide/termpad/pull/35) [`f749e05`](https://github.com/meganide/termpad/commit/f749e050aaf4988c3566c14648c6f9ce39bc5d4e) Thanks [@meganide](https://github.com/meganide)! - Add an Open ports view to inspect listening TCP ports and manage the processes using them.
  - Filter by Termpad, Outside Termpad, or All, with Termpad selected by default and unique process counts on each filter.
  - Search by port, process, PID, or address and see CPU averages and resident memory usage, refreshed every five seconds while the view is open.
  - Jump to the owning agent or user terminal from a process's actions menu.
  - Stop or force-stop a process, with an optional checkbox to close its terminal tab and release saved output.
  - Keep the dialog and table layout stable when switching filters.

  Support discovery on macOS, Linux, Windows, and running WSL distributions. Recheck process identity before stopping it and protect Termpad's own process.

- [#38](https://github.com/meganide/termpad/pull/38) [`289a14e`](https://github.com/meganide/termpad/commit/289a14ee63bb0531f515e9bbdaf57a523b7a9db2) Thanks [@meganide](https://github.com/meganide)! - Enlarge the Performance modal and move Open ports into it, replacing the separate sidebar entry. Remember the selected Performance tab when the modal reopens and pause polling for inactive views. Load resource counts on open even when the saved tab is Open ports. Show the open-port count in its tab, loading it on open and updating it after port scans.

- [#32](https://github.com/meganide/termpad/pull/32) [`56f6076`](https://github.com/meganide/termpad/commit/56f60761aa503ebc1afb8a2aa0b7c2c5ce5f022e) Thanks [@meganide](https://github.com/meganide)! - Add a browser to the right panel with repository-scoped tabs, a tab count, an expandable view, and native right-click menus. Repositories start with zero browser tabs, and the last tab can be closed.

  Add DevTools inside a resizable right-hand pane, with drag and keyboard resizing and a double-click reset. Show errors when a browser page crashes or DevTools cannot load.

- [#38](https://github.com/meganide/termpad/pull/38) [`289a14e`](https://github.com/meganide/termpad/commit/289a14ee63bb0531f515e9bbdaf57a523b7a9db2) Thanks [@meganide](https://github.com/meganide)! - Add a Performance view for Termpad terminals, running processes, and browser tabs. Inspect live CPU and memory usage across repositories, sort and filter the list, jump to an item's terminal or browser tab, and close tabs or stop processes. Include Windows and running WSL processes while protecting Termpad's app helpers.

- [#39](https://github.com/meganide/termpad/pull/39) [`23e30a0`](https://github.com/meganide/termpad/commit/23e30a0d5513e728f4cf7dc3649ffe72552b458a) Thanks [@meganide](https://github.com/meganide)! - Send todos to the active terminal or create a named worktree from a todo, move it into the new worktree, and submit it to the automatically started default terminal. Mark dispatched todos as in progress and separate consecutive sends with a newline.

  Add list and kanban views with Backlog, In progress, Done, and custom columns. Drag todos between columns or list accordions to update their status, preview todos while dragging, and reorder kanban columns. Save custom columns and their order per repository, and support manual status changes from todo menus.

  Add expand and collapse controls to every right-panel tab and improve spacing in todo action menus.

### Patch Changes

- [#37](https://github.com/meganide/termpad/pull/37) [`14db173`](https://github.com/meganide/termpad/commit/14db173e92b8db286dd45270e7d2327a14fe2247) Thanks [@meganide](https://github.com/meganide)! - Automatically open a terminal and run the default terminal preset command after creating a worktree. Open a plain shell when Terminal is the default.

- [#34](https://github.com/meganide/termpad/pull/34) [`c2bc382`](https://github.com/meganide/termpad/commit/c2bc382973b12c71ac61e1974505bc31565bf80c) Thanks [@meganide](https://github.com/meganide)! - Fix terminal hyperlinks opening in the default browser without a warning popup, and prevent right-clicks and macOS Ctrl-clicks from opening links so the copy menu remains usable.

- [#40](https://github.com/meganide/termpad/pull/40) [`29c2c95`](https://github.com/meganide/termpad/commit/29c2c95f22e8eec986b7f13db2aacacecb5655aa) Thanks [@meganide](https://github.com/meganide)! - Preserve terminal scroll positions when switching between agent overview and worktree views, including when Codex clears and redraws its transcript after resizing. Keep following new output when already scrolled to the bottom.

- [#36](https://github.com/meganide/termpad/pull/36) [`3f2c340`](https://github.com/meganide/termpad/commit/3f2c340c22e469179e8cede72d786187886ec75a) Thanks [@meganide](https://github.com/meganide)! - Show the current Termpad version in the sidebar instead of the LOCAL label.

## 0.8.0

### Minor Changes

- [#30](https://github.com/meganide/termpad/pull/30) [`0f93ffe`](https://github.com/meganide/termpad/commit/0f93ffe59e85a2892b19c8c09f5c6498bf9667ed) Thanks [@meganide](https://github.com/meganide)! - Refresh the workspace with a neutral graphite theme, clearer sidebar navigation, and a redesigned home screen with live workspace counts, recent worktrees, and direct repository actions. Polish setup screens, settings, terminal panels, and empty states, and make the Cmd + O shortcut easier to read. Opening a repository without worktrees now starts worktree setup.

## 0.7.0

### Minor Changes

- [#27](https://github.com/meganide/termpad/pull/27) [`7ac333a`](https://github.com/meganide/termpad/commit/7ac333aab7242ac909f79b724be1ef88e648c901) Thanks [@meganide](https://github.com/meganide)! - Add sidebar search for repository names, worktree names, labels, and branches. Matching worktrees are revealed automatically, and clearing the search restores the original expansion state. Keyboard navigation and drag reordering respect filtered results.

  Keep the file tree scrollable within its panel while the search and filter controls remain visible.

### Patch Changes

- [#29](https://github.com/meganide/termpad/pull/29) [`e380714`](https://github.com/meganide/termpad/commit/e380714869b0df25cf05ca981f591013263b4b56) Thanks [@meganide](https://github.com/meganide)! - Reduce background review and Git work, defer offscreen diff rendering, and reuse unchanged file data. Bound terminal replay memory and apply output flow control to keep busy terminal sessions responsive.

## 0.6.0

### Minor Changes

- [#25](https://github.com/meganide/termpad/pull/25) [`9006fb5`](https://github.com/meganide/termpad/commit/9006fb554ad624e46691c34c4bc00ad3f774df06) Thanks [@meganide](https://github.com/meganide)! - feat: separate global notes and todos from worktree content

  The primary checkout shows repository-wide Global notes and todos, while each linked worktree shows only its own content. Existing primary-checkout content is preserved in the global scope. Tab indicators reflect only the current scope, with completed/total todo counts and an indicator for saved notes. Todo actions are available from a dropdown or right-click menu, including moving a global todo to another worktree.

- [#25](https://github.com/meganide/termpad/pull/25) [`9006fb5`](https://github.com/meganide/termpad/commit/9006fb554ad624e46691c34c4bc00ad3f774df06) Thanks [@meganide](https://github.com/meganide)! - feat: review changes and use terminals in dedicated workspace tabs

  Review now opens directly in its own tab alongside Changes, Terminals, Notes and Todos. Choose the current branch for uncommitted changes or another base branch, such as main or master, to review branch changes. Changes and Review show changed-file counts, and Terminals shows the number of open terminals.

  The review file tree can be collapsed or resized, with its width retained when switching worktrees. Resizing no longer selects text. Files start expanded without unfolding unchanged context, review icon actions have tooltips, and each available file can be opened in the configured editor.

- [#25](https://github.com/meganide/termpad/pull/25) [`9006fb5`](https://github.com/meganide/termpad/commit/9006fb554ad624e46691c34c4bc00ad3f774df06) Thanks [@meganide](https://github.com/meganide)! - feat: move notes into the right panel and add a todos tab

  Notes no longer cover the terminal. The right panel now has Changes, Notes and Todos tabs, and can be resized up to 1000px. Todos support add, edit, complete and delete, scoped to either the repository or the worktree, and persist alongside notes.

- [#26](https://github.com/meganide/termpad/pull/26) [`7fe344d`](https://github.com/meganide/termpad/commit/7fe344db15ebe3e14d70186755547d956c296d83) Thanks [@meganide](https://github.com/meganide)! - Add a grid toggle to show all terminal tabs in a worktree. The agent overview uses a full-area interactive grid with a repository filter, and repository grid buttons open that same overview with the matching filter applied. Right-click a terminal to navigate to its worktree or hide it from the overview. Restore hidden agents individually or together from the overview header. Switching layouts preserves running terminals and scrollback.

- [#21](https://github.com/meganide/termpad/pull/21) [`2e50d02`](https://github.com/meganide/termpad/commit/2e50d0278e871e3bd9d02675fbcb45bb10c257dd) Thanks [@meganide](https://github.com/meganide)! - Add a live agent overview grouped by repository, with larger responsive terminal previews, hover highlights, and arrow-key navigation. Open the overview from the sidebar or with Ctrl+O, press Enter to open a terminal, and right-click a card to close it with confirmation for active processes. Switching views preserves terminal scrollback.

- [#25](https://github.com/meganide/termpad/pull/25) [`9006fb5`](https://github.com/meganide/termpad/commit/9006fb554ad624e46691c34c4bc00ad3f774df06) Thanks [@meganide](https://github.com/meganide)! - feat: give notes and todos the full right panel, and add todo priority, reordering, dates and copy

  Notes and todos now use the full height of the right panel, with user terminals available in their own Terminals tab. Todos gained colour-coded priorities, drag-to-reorder, a visible creation date, and a copy action. New todos are added at the top.

### Patch Changes

- [#23](https://github.com/meganide/termpad/pull/23) [`fb34f10`](https://github.com/meganide/termpad/commit/fb34f10f876e17a05a8565f94980c8eed7be2f64) Thanks [@meganide](https://github.com/meganide)! - Add a saved sidebar toggle beside Home to show only repositories with open terminals, including terminals in any worktree or the lower terminal panel.

- [#24](https://github.com/meganide/termpad/pull/24) [`ee757e0`](https://github.com/meganide/termpad/commit/ee757e0a114068faf0fbba72a2a9750557438fca) Thanks [@meganide](https://github.com/meganide)! - Show and select the main worktree immediately after using "Initialize Git repository for me", without needing to remove and re-add the repository.

- [#26](https://github.com/meganide/termpad/pull/26) [`7fe344d`](https://github.com/meganide/termpad/commit/7fe344db15ebe3e14d70186755547d956c296d83) Thanks [@meganide](https://github.com/meganide)! - Add agent overview shortcuts: Cmd+O to toggle the overview, Cmd+I to open the overview for the current repository, Cmd+Arrow keys to select visible agents, Cmd+Shift+Enter to open the selected agent in its worktree, and Cmd+- to close it with the existing running-terminal confirmation. Use Ctrl on Windows and Linux.

  Register global keyboard shortcuts once so returning from the overview to a worktree does not cause another listener to swallow the repository overview shortcut.

- [#25](https://github.com/meganide/termpad/pull/25) [`9006fb5`](https://github.com/meganide/termpad/commit/9006fb554ad624e46691c34c4bc00ad3f774df06) Thanks [@meganide](https://github.com/meganide)! - feat: keep the worktree folder action beside the editor dropdown

  A dedicated folder button opens the selected worktree in the file manager without changing the preferred editor. The adjacent editor dropdown contains Cursor and VS Code, keeping folder access available regardless of the selected editor.

- [#25](https://github.com/meganide/termpad/pull/25) [`9006fb5`](https://github.com/meganide/termpad/commit/9006fb554ad624e46691c34c4bc00ad3f774df06) Thanks [@meganide](https://github.com/meganide)! - feat: open long todos in a dialog

  Todo rows now clamp to two lines, and an expand button opens the full todo in a dialog with room to read and edit it.

- [#25](https://github.com/meganide/termpad/pull/25) [`9006fb5`](https://github.com/meganide/termpad/commit/9006fb554ad624e46691c34c4bc00ad3f774df06) Thanks [@meganide](https://github.com/meganide)! - feat: give todos multi-line input and a completed section

  Todo text is now edited in an auto-growing textarea (Enter saves, Shift+Enter adds a line), and completed todos collapse into a "Completed" accordion you can un-tick to restore them.

- [#25](https://github.com/meganide/termpad/pull/25) [`9006fb5`](https://github.com/meganide/termpad/commit/9006fb554ad624e46691c34c4bc00ad3f774df06) Thanks [@meganide](https://github.com/meganide)! - feat: allow the right panel to be dragged out to 2000px

  The right panel's maximum width is now 2000px, up from 1000px, giving notes and todos more room on wide displays.

## 0.5.5

### Patch Changes

- [`e9df3cc`](https://github.com/meganide/termpad/commit/e9df3cc54071e2c4b1ce28b64a71290c9f9a919b) Thanks [@meganide](https://github.com/meganide)! - fix: skip code signature verification for unsigned macOS auto-updates

- [#20](https://github.com/meganide/termpad/pull/20) [`e924244`](https://github.com/meganide/termpad/commit/e9242449e43b291382eb5519282559f16d5b1aca) Thanks [@meganide](https://github.com/meganide)! - fix: prevent macOS freezes when watching large repositories

## 0.5.4

### Patch Changes

- [#17](https://github.com/meganide/termpad/pull/17) [`6de6375`](https://github.com/meganide/termpad/commit/6de637575f4a65f886476f5cd73c711696347afa) Thanks [@meganide](https://github.com/meganide)! - Improve application responsiveness and resource usage across terminals, Git operations, and repository monitoring. Terminal output and resize work are now batched, terminal rendering uses WebGL when available, expensive Git and shell operations are cached, and polling-based repository refreshes have been replaced with event-driven updates.

## 0.5.3

### Patch Changes

- [#14](https://github.com/meganide/termpad/pull/14) [`72777c2`](https://github.com/meganide/termpad/commit/72777c269402712330d3a5572ea5e015ff565e4b) Thanks [@meganide](https://github.com/meganide)! - Fix Run button tooltip covering dropdown options. The tooltip on the Run split button stayed visible while the dropdown was open, overlapping the script options. The tooltip now applies only to the main button, not the dropdown chevron.

## 0.5.2

### Patch Changes

- [#12](https://github.com/meganide/termpad/pull/12) [`76524ef`](https://github.com/meganide/termpad/commit/76524efc1d7ce012121e1cb7b9f940094d00128f) Thanks [@meganide](https://github.com/meganide)! - Enable OSC52 clipboard support in the terminal so programs running inside a session (e.g. Claude Code, vim, tmux) can write to the system clipboard.

## 0.5.1

### Patch Changes

- [#10](https://github.com/meganide/termpad/pull/10) [`6c544bf`](https://github.com/meganide/termpad/commit/6c544bfcdb6fd26ae98f83fce11a0fc460577229) Thanks [@meganide](https://github.com/meganide)! - Fix terminal scroll position jumping to top during resize/reflow

  When xterm.js reflows content (e.g., due to a container resize triggering `fitAddon.fit()`), the viewport scroll position could reset to line 0. This caused the terminal to jump to the top when the user had scrolled up, particularly noticeable when Claude Code was producing lots of output. The scroll position is now saved before fit and restored afterward, preserving the user's scroll position.

## 0.5.0

### Minor Changes

- [#8](https://github.com/meganide/termpad/pull/8) [`6141c6a`](https://github.com/meganide/termpad/commit/6141c6a930f33f3571d64cdc9e07f52fe30446d8) Thanks [@meganide](https://github.com/meganide)! - Add shared termpad.json config for team script sharing
  - Add support for a `termpad.json` file at the repository root with shared setup, run, and cleanup scripts
  - Detects the config file on project open and shows a sync button with badge on the Scripts settings page
  - Scripts are never auto-applied; users must explicitly click sync to apply
  - Watches the file for changes (e.g., after git pull) and updates the badge
  - Fix state corruption when saving full store state with non-serializable Set/Map fields

## 0.4.0

### Minor Changes

- [#6](https://github.com/meganide/termpad/pull/6) [`e12db93`](https://github.com/meganide/termpad/commit/e12db93a937aa54f29b55b35efb7b58bbe57ae32) Thanks [@meganide](https://github.com/meganide)! - Add notes feature for repositories and worktrees
  - Write and persist notes at both repository and worktree level
  - WYSIWYG rich text editor with live formatting preview
  - Formatting toolbar: headings, bold, italic, strikethrough, inline code, bullet lists, blockquotes
  - Toolbar buttons show active state for current cursor position
  - Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y redo, Ctrl+B bold, Ctrl+I italic
  - Notes persist across app restarts via the main app state
  - Toggle notes panel from the notebook icon in the worktree bar

## 0.3.2

### Patch Changes

- [#4](https://github.com/meganide/termpad/pull/4) [`ac7c0d9`](https://github.com/meganide/termpad/commit/ac7c0d9b79a90e0acfe1ef88576ae3c8c8f0bfed) Thanks [@meganide](https://github.com/meganide)! - Strip leading and trailing whitespace from each line when copying terminal text to clipboard

## 0.3.1

### Patch Changes

- [#84](https://github.com/meganide/termpad/pull/84) [`98ead48`](https://github.com/meganide/termpad/commit/98ead4833a1f2e3b19fe3f6e19c18599e6ad8f24) Thanks [@meganide](https://github.com/meganide)! - Replace Space Grotesk with Inter for improved readability across the UI

## 0.3.0

### Minor Changes

- [#82](https://github.com/meganide/termpad/pull/82) [`f98a011`](https://github.com/meganide/termpad/commit/f98a011de6d78f3a3d2ff3f464343e35ad225a2c) Thanks [@meganide](https://github.com/meganide)! - Persist user terminal output across worktree switches. User terminals now retain their output when navigating between worktrees, so you no longer lose your terminal history when switching contexts.

## 0.2.2

### Patch Changes

- [#81](https://github.com/meganide/termpad/pull/81) [`e444f62`](https://github.com/meganide/termpad/commit/e444f62c1782be47210cdd3d94ec57ec190d998b) Thanks [@meganide](https://github.com/meganide)! - Fix feedback submission failing with a JSON parse error when the server returns a non-JSON response

- [#79](https://github.com/meganide/termpad/pull/79) [`3fa252f`](https://github.com/meganide/termpad/commit/3fa252fb1f69334989d2d052ddd269b2fed3d4e0) Thanks [@meganide](https://github.com/meganide)! - Show a manual download link for .deb and .rpm users when an update is available, since auto-update is not supported for system-managed packages

## 0.2.1

### Patch Changes

- [`e482e4c`](https://github.com/meganide/termpad/commit/e482e4c3db3fd801f7e56fddff262cdc96e90d2f) Thanks [@meganide](https://github.com/meganide)! - Fix auto-update failing when clicking "Download" on a new version

## 0.2.0

### Minor Changes

- [#76](https://github.com/meganide/termpad/pull/76) [`b86c439`](https://github.com/meganide/termpad/commit/b86c4396d0fbdc99b565ad296e2580284ca5d46d) Thanks [@meganide](https://github.com/meganide)! - Add feedback dialog allowing users to submit feedback directly from the app
