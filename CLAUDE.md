# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

**IMPORTANT**: Never commit or push without explicit user request. Only run `git commit` or `git push` when the user explicitly asks (e.g., "commit", "commit and push", "push").

## Package Manager

**IMPORTANT**: This project uses **bun** for package management. Always use `bun` instead of `npm` or `pnpm`.

## Build & Development Commands

```bash
# Start development (Electron + Vite hot reload)
bun start

# Run all tests
bun test

# Run tests once (no watch)
bun run test:run

# Run a single test file
bun run vitest run src/renderer/hooks/useGitStatus.test.ts

# Type checking
bun run typecheck

# Linting
bun run lint

# Format code
bun run format
```

## Architecture Overview

Termpad is an **Electron application** for managing multiple Claude Code terminal sessions. It uses a three-process Electron architecture:

### Process Structure

- **Main Process** (`src/main/`) - Node.js backend handling terminals, git operations, file system, and IPC
- **Preload** (`src/preload/preload.ts`) - Bridge exposing typed APIs to renderer via `contextBridge`
- **Renderer** (`src/renderer/`) - React frontend with Vite HMR

### Key Architectural Patterns

**IPC Communication**: All main/renderer communication flows through typed APIs defined in `src/shared/types.ts`. The preload script exposes four API namespaces:

- `window.electronAPI` - Window controls
- `window.terminal` - Terminal lifecycle & git operations
- `window.storage` - State persistence
- `window.watcher` - File system watching for git changes

**State Management**: Zustand store in `src/renderer/stores/appStore.ts` manages both persisted state (projects, sessions, settings) and runtime state (terminal statuses). State persists to JSON via IPC.

**Terminal Management**: `src/main/terminalManager.ts` wraps `node-pty` for pseudo-terminal handling. Each session gets its own terminal instance tracked by session ID.

**Git Worktree Model**: Projects can have multiple sessions - one "main" session and additional "worktree" sessions. Worktrees are discovered and watched via `src/main/services/worktreeWatcher.ts`.

### Cross-Platform Compatibility

**CRITICAL**: All features and changes must work across all supported platforms. No regressions allowed.

**Supported Platforms:**

- Windows (native paths)
- Windows with WSL (Linux paths accessed via `\\wsl$\` or `\\wsl.localhost\`)
- Linux
- macOS

**Supported Terminals**: Users can configure their preferred shell in settings. Code must work with bash, zsh, PowerShell, cmd, and WSL shells.

**File Path Handling:**

- Paths may contain spaces, special characters, or unicode
- For shell commands with file paths, prefer `execFile`/`execFileAsync` (bypasses shell, passes args as array) over `exec` with string interpolation
- When shell execution is required (e.g., WSL), use single quotes for paths and escape embedded single quotes: `'path'` with `'\\''` for literal `'`
- Use `--` separator before file paths in git commands to distinguish paths from options
- Check `isWslPath()` in `src/main/gitOperations.ts` to detect WSL paths and handle them appropriately

**Before Implementing:**

- Consider how the feature will work on Windows, WSL, Linux, and macOS
- Consider how it will work with different shell configurations
- Test path handling with spaces and special characters

### UI & Styling

- **Tailwind CSS** for styling - use utility classes, avoid custom CSS
- **shadcn/ui** components in `src/renderer/components/ui/` - use these for consistent UI patterns
- **Tooltips**: Do not use the native `title` attribute for tooltips - use the shadcn/ui `Tooltip` component instead

---

## Obsidian & Lime Design System

A futuristic glassmorphism design system with high contrast, blurred transparency, and tech-industrial typography. Uses bento-grid structure and floating layouts.

### Color System

All colors are defined in `src/renderer/index.css`. Always use Tailwind classes to reference them.

#### Core Palette (Tailwind Classes)

| Purpose                    | Tailwind Class    | CSS Variable     |
| -------------------------- | ----------------- | ---------------- |
| Deep black shell           | `bg-obsidian-950` | `--obsidian-950` |
| Obsidian surface           | `bg-obsidian-800` | `--obsidian-800` |
| Obsidian base              | `bg-obsidian-900` | `--obsidian-900` |
| Primary accent (Neon Lime) | `bg-lime-500`     | `--lime-500`     |
| Secondary accent (Emerald) | `bg-emerald-500`  | `--emerald-500`  |
| Light contrast section     | `bg-obsidian-50`  | `--obsidian-50`  |

#### Semantic Colors

| Purpose         | Tailwind Class                       |
| --------------- | ------------------------------------ |
| Background      | `bg-background`                      |
| Foreground text | `text-foreground`                    |
| Primary         | `bg-primary` / `text-primary`        |
| Secondary       | `bg-secondary` / `text-secondary`    |
| Muted           | `bg-muted` / `text-muted-foreground` |
| Card surfaces   | `bg-card`                            |
| Borders         | `border-border`                      |

#### Text Colors

| Purpose                 | CSS Variable       | Usage                   |
| ----------------------- | ------------------ | ----------------------- |
| Primary white           | `--text-primary`   | Main headings, body     |
| Secondary (60% opacity) | `--text-secondary` | Subtitles, descriptions |
| Muted (30% opacity)     | `--text-muted`     | Disabled, hints         |

### Typography

- **Headings:** Space Grotesk (weights 300-700, tracking: `-tracking-[0.06em]`)
- **Body:** Space Grotesk (weight 400)
- **Technical labels:** JetBrains Mono (`font-mono uppercase tracking-[0.2em] text-[10px]`)

### Glassmorphism

Use sparingly for floating elements, navigation on scroll, and overlay components:

```html
<!-- Glass card with rounded corners (for floating elements) -->
<div class="glass-card">...</div>
```

Or apply manually:

- Background: `bg-[var(--glass-bg)]`
- Backdrop blur: `backdrop-blur-[16px]`
- Border: `border border-[var(--glass-border)]` (only for glass effects)

**Note:** Glass effects with borders are appropriate for floating/overlay elements. For regular cards and containers, use solid background colors instead (see Visual Separation section).

### Animation Classes

| Class                | Effect               |
| -------------------- | -------------------- |
| `animate-float`      | 6s floating up/down  |
| `animate-pulse-glow` | 2s opacity pulse     |
| `glow-lime`          | Lime neon box-shadow |

### Visual Separation

**Prefer background colors over borders** for separating content. Use the obsidian color palette for subtle differentiation:

| Element              | Style                                                     |
| -------------------- | --------------------------------------------------------- |
| Section badges/pills | `bg-obsidian-700/60` or `bg-lime-500/15` (no border)      |
| Cards                | `bg-obsidian-800/60 hover:bg-obsidian-800/80` (no border) |
| Tags/chips           | `bg-obsidian-600/60` (no border)                          |
| Info boxes           | `bg-obsidian-800/60` (no border)                          |
| Buttons (secondary)  | `bg-obsidian-700/60 hover:bg-obsidian-600/60` (no border) |

**When to use borders:**

- App preview components (simulating real UI chrome like window frames, sidebars, tabs)
- Navigation on scroll (`border border-white/10` for glass effect)
- Footer separator (`border-t border-white/5`)
- Active/selected states (`border border-lime-500/20` to indicate state)
- Functional separators inside UI mockups

**When NOT to use borders:**

- Card containers (use background color difference instead)
- Section badges and pills (use solid/semi-transparent backgrounds)
- Tags and chips (use background colors)
- Buttons (use background colors)
- Decorative separation (use spacing and background colors)

### Depth & Elevation

Use shadows and background color layering to create visual hierarchy and depth. Darker backgrounds recede, lighter backgrounds come forward.

| Element                | Style                                                   |
| ---------------------- | ------------------------------------------------------- |
| Sidebar/nav panels     | `bg-obsidian-900 shadow-[4px_0_16px_rgba(0,0,0,0.3)]`   |
| Floating panels        | `bg-obsidian-800 shadow-[0_4px_24px_rgba(0,0,0,0.4)]`   |
| Headers                | `bg-obsidian-900/50 shadow-[0_2px_8px_rgba(0,0,0,0.2)]` |
| Recessed areas/footers | `bg-obsidian-950/50` (deepest, no shadow)               |
| Content areas          | `bg-obsidian-950` (base level)                          |
| Cards/inputs on base   | `bg-obsidian-800/60` (elevated from base)               |

**Depth principles:**

- Use `shadow-[Xpx_Ypx_Zpx_rgba(0,0,0,opacity)]` for drop shadows on elevated elements
- Horizontal shadows (`4px_0_...`) for side panels, vertical shadows (`0_2px_...`) for headers
- Larger blur radius and higher opacity = more elevation
- Combine shadows with semi-transparent backgrounds for layered depth
- Footers and recessed areas use darker backgrounds without shadows

### Design Rules

- MUST use `bg-lime-500` for primary accent
- MUST use Space Grotesk and JetBrains Mono fonts
- MUST maintain 16px blur on glass elements (`backdrop-blur-[16px]`)
- MUST use high border-radius (at least `rounded-2xl` for cards, `rounded-lg` for inputs/small elements)
- MUST prefer background colors over borders for visual separation
- MUST add depth via shadows on elevated elements (sidebars, headers, floating panels)
- NEVER hardcode color values - always use Tailwind classes referencing `index.css`

### Directory Conventions

- `src/renderer/components/ui/` - shadcn/ui components (auto-generated, excluded from lint/test coverage)
- `src/renderer/features/` - Feature modules (workspace, chat)
- `src/renderer/hooks/` - React hooks
- `src/renderer/stores/` - Zustand stores
- `src/shared/types.ts` - Shared TypeScript types and API contracts

### Testing

Tests use **Vitest** with **jsdom** environment and **React Testing Library**. Test files are colocated with source files (`*.test.ts(x)`). The test setup mocks Electron APIs in `tests/setup.ts`.

Path alias: `@/*` maps to `./src/renderer/*`

## Performance & Resource Management

Always consider performance, memory usage, and CPU efficiency in implementations:

### Terminal Management

- Dispose `node-pty` instances properly when sessions close - call `terminal.kill()` and remove from tracking maps
- Clean up terminal data listeners and IPC handlers when terminals are destroyed
- Avoid accumulating terminal output buffers indefinitely - implement scrollback limits if needed
- Remove terminal resize listeners when sessions end

### Git Operations

- Debounce git status checks - avoid running on every keystroke or rapid file changes
- Cancel pending git operations when starting new ones (e.g., user switches branches mid-operation)
- Run git commands asynchronously to avoid blocking the main process
- Clean up worktree watchers when projects are removed or worktrees deleted

### File Watching

- Remove file system watchers (`worktreeWatcher`, git status watchers) when:
  - Projects are removed from the app
  - Sessions are closed
  - Watched paths no longer exist
- Debounce file change events to batch rapid successive changes
- Use targeted watch paths rather than watching entire directory trees

### IPC & Main Process

- Batch IPC calls when possible (e.g., bulk state updates vs. individual calls)
- Avoid synchronous IPC - use async handlers to keep UI responsive
- Clean up IPC listeners in preload when renderer unloads
- Don't block main process with heavy computation - offload to worker threads if needed

### React & Renderer

- Use `useCallback` and `useMemo` to prevent unnecessary re-renders, especially for terminal components
- Clean up effects properly in `useEffect` return functions
- Debounce resize handlers for terminal fitting
- Memoize expensive computations (e.g., filtering/sorting session lists)

### Zustand Store

- Use selectors to subscribe to specific state slices, avoiding re-renders on unrelated state changes
- Avoid storing derived state that can be computed
- Clean up any store subscriptions in useEffect cleanup
