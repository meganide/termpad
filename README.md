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
- **Built-in diff viewer** - Review code changes across branches without leaving the app
- **Source control** - Stage, commit, push, and manage git operations from the UI
- **Desktop notifications** - Get notified when long-running terminal tasks complete
- **Auto-updates** - Stay current with automatic update checks and one-click installs
- **Cross-platform** - Works on Windows, macOS, and Linux (including WSL)

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
