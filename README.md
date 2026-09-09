# Termpad

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An AI orchestration tool for managing multiple AI coding agent sessions. Run Claude Code, Gemini CLI, Codex, or any LLM CLI in parallel with git worktree support, terminal tabs, and a built-in diff viewer.

**[Website](https://www.termpad.com/)** | **[Documentation](https://docs.termpad.com/)** | **[Download](https://github.com/meganide/termpad/releases/latest)**

## Features

<img width="1863" height="1028" alt="image" src="https://github.com/user-attachments/assets/3511cf87-f6ac-43dd-a722-584cafee0b9d" />
<img width="1394" height="886" alt="image" src="https://github.com/user-attachments/assets/23cf25ac-429a-4443-9b43-23765330d3a8" />
<img width="350" height="278" alt="image" src="https://github.com/user-attachments/assets/6c7a2790-8c52-4e94-aa9d-0cad822b78b6" />

- **Multiple terminal sessions** - Run Claude Code, Gemini CLI, Codex, or any other AI coding agent installed on your machine in parallel
- **Git worktree integration** - Create and manage worktrees directly from the sidebar for isolated feature branches
- **Terminal tabs** - Open multiple terminal tabs per worktree (Claude, Gemini, plain shell, custom presets)
- **Worktree grid view** - Show all open tabs together with a single grid toggle
- **Performance view** — Open **Performance** in the sidebar to inspect Termpad terminals, child processes, and browser tabs across repositories. Sort by CPU, memory, name, type, workspace, or PID; search, jump to an item, close a tab, or stop a process. Readings refresh every two seconds while the view is visible.
- **Agent overview** - Interact with all open agents in one live grid, with an optional repository filter
- **Built-in diff viewer** - Review code changes across branches without leaving the app
- **Source control** - Stage, commit, push, and manage git operations from the UI
- **Desktop notifications** - Get notified when long-running terminal tasks complete
- **Auto-updates** - Stay current with automatic update checks and one-click installs
- **Cross-platform** - Works on Windows, macOS, and Linux (including WSL)

### Terminal split views

Within a worktree, open at least two terminal tabs and click the **Worktree grid view** icon in the tab bar. All open tabs appear in an automatic grid, and new tabs join it immediately. Click any terminal to interact with it. Click the grid icon again to return to the selected tab, or use a pane's expand button to show only that terminal.

Use the grid button beside a repository's name, or its **Open agent overview** context menu action, to open the agent overview filtered to that repository. The overview fills the terminal area with a live grid. Its repository filter lets you switch repositories or show **All repositories**. Click a terminal to work in it, or right-click and choose **Open in worktree** to navigate to its worktree. Copy, paste, and close are available in the same menu. Choose **Hide from overview** to remove an agent from the grid while keeping its terminal running. Use **Hidden** in the header to restore individual agents or all hidden agents in the current repository filter. Hidden selections are remembered while the app is open and do not affect worktree views. Use **Cmd+O** to toggle the overview or **Cmd+I** to open it filtered to the current repository. In the overview, use **Cmd+Arrow keys** to select a visible agent, **Cmd+Shift+Enter** to open it in its worktree, and **Cmd+-** to close it. Use **Ctrl** instead of Cmd on Windows/Linux. Closing a running agent asks for confirmation.

Switching views keeps terminals running and preserves scrollback. Each worktree remembers its grid setting during the current app session.

### Performance readings

Terminal rows include their child processes. Browser rows show their renderer process usage; tabs that share a renderer are marked **Shared process**. Overall totals count each process once, including Termpad’s app helpers. App helpers are protected from being stopped in this view.

CPU is measured between samples (100% is one core); newly discovered processes need a second reading. Memory is resident memory / working set, so shared memory can appear in more than one process. Windows and running WSL distributions are measured separately. WSL processes are associated using the terminal marker inherited from Termpad. A failed WSL scan is shown as a warning.

The view tracks this Termpad instance and descendants it has observed. A process that detached before it could be observed may not appear. Closing a terminal uses Termpad’s existing terminal cleanup; a process that deliberately detaches or ignores shell shutdown may need to be stopped separately.

## Platform Support

| Platform              | Status    |
| --------------------- | --------- |
| Windows               | Supported |
| Windows + WSL         | Supported |
| macOS (Apple Silicon) | Supported |
| macOS (Intel)         | Supported |
| Linux (AppImage)      | Supported |
| Linux (deb/rpm)       | Supported |

## Installation

Download the latest release for your platform from [GitHub Releases](https://github.com/meganide/termpad/releases/latest).

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Bun](https://bun.sh/)

### Run Locally

```bash
bun install
bun start
```

This starts Electron in development mode with Vite hot reload.

### Build

```bash
# Package the app (no installer)
bun run package

# Build distributable installers for your platform
bun run make
```

The output will be in the `out/` directory.

### Testing

```bash
# Run all tests
bun test

# Run tests once (no watch)
bun run test:run

# Type checking
bun run typecheck

# Linting
bun run lint

# Format code
bun run format
```

## Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/meganide/termpad/issues/new).

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

### Workflow

1. Fork the repo and create your branch from `main`
2. Make your changes
3. Make sure tests, type checking, and linting all pass:
   ```bash
   bun run test:run
   bun run typecheck
   bun run lint
   ```
4. Add a changeset describing your changes (see below)
5. Open a pull request

### Changesets

This project uses [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. Every PR that changes user-facing behavior must include a changeset.

After making your changes, run:

```bash
bunx changeset
```

This will prompt you to select the type of change (patch, minor, or major) and write a short summary. It creates a markdown file in `.changeset/` that should be committed with your code.

You can run this multiple times per PR if you made several distinct changes (e.g., a bug fix and a new feature). Each one becomes a separate changelog entry.

## License

[MIT](LICENSE)
