# termpad

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
