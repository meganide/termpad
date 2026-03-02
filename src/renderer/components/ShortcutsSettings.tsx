import { isMac } from '../utils/shortcuts';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

// Platform-specific modifier symbols
const ctrl = isMac ? '⌃' : 'Ctrl';
const cmd = isMac ? '⌘' : 'Ctrl';

// Detect Linux for keyboard shortcut display
// On Linux, Ctrl+Space is reserved by input method frameworks, so we use Ctrl+Shift+Space
const isLinux = typeof window !== 'undefined' && window.electronAPI?.platform === 'linux';
const sidebarShortcut = isLinux ? `${ctrl} + Shift + Space` : `${ctrl} + Space`;

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: 'F1', description: 'Open keyboard shortcuts' },
      {
        keys: sidebarShortcut,
        description: 'Toggle focus between terminal and sidebar',
      },
      {
        keys: `${cmd} + ,`,
        description: 'Open settings',
      },
      {
        keys: `${ctrl} + G`,
        description: 'Add repository',
      },
    ],
  },
  {
    title: 'Terminal Focus',
    shortcuts: [
      { keys: `${ctrl} + T`, description: 'Switch to main terminal' },
      { keys: `${ctrl} + U`, description: 'Switch to user terminal' },
    ],
  },
  {
    title: 'Tab Management (when terminal is focused)',
    shortcuts: [
      { keys: `${ctrl} + W`, description: 'Create new tab' },
      { keys: `${ctrl} + Q`, description: 'Close current tab' },
      { keys: `${cmd} + 1-9`, description: 'Jump to tab by index' },
    ],
  },
  {
    title: 'Sidebar Navigation (when sidebar is focused)',
    shortcuts: [
      { keys: 'Arrow Up / Down', description: 'Navigate between repositories and sessions' },
      { keys: 'Arrow Left', description: 'Collapse repository or move to parent' },
      { keys: 'Arrow Right', description: 'Expand repository or enter status indicators' },
      { keys: 'Enter', description: 'Toggle repository expand/collapse or select session' },
      { keys: 'Escape', description: 'Return focus to terminal' },
      { keys: '1-9, 0', description: 'Quick jump to item (0 = 10th item)' },
    ],
  },
  {
    title: 'Status Indicator Navigation (when in status indicator mode)',
    shortcuts: [
      { keys: 'Arrow Left / Right', description: 'Navigate between status indicators' },
      { keys: 'Arrow Up / Down', description: 'Move to previous/next worktree session' },
      { keys: 'Enter', description: 'Open terminal for the focused indicator' },
      { keys: 'Arrow Left (at first)', description: 'Exit status indicator mode' },
    ],
  },
];

export function ShortcutsSettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-0.5">
        <p className="text-sm text-muted-foreground">
          Use these shortcuts to navigate the application quickly
        </p>
      </div>

      <div className="space-y-6">
        {shortcutGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold text-foreground mb-3">{group.title}</h3>
            <div className="space-y-2">
              {group.shortcuts.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{shortcut.description}</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-muted/40 rounded shadow-[0_1px_0_1px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] whitespace-nowrap">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
