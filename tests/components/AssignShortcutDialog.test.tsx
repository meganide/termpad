import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AssignShortcutDialog } from '../../src/renderer/components/AssignShortcutDialog';
import type { WorktreeSession, CustomShortcut } from '../../src/shared/types';

// Mock the store
const mockUpdateWorktreeSessionShortcut = vi.fn();
vi.mock('../../src/renderer/stores/appStore', () => ({
  useAppStore: vi.fn(() => ({
    projects: [],
    updateWorktreeSessionShortcut: mockUpdateWorktreeSessionShortcut,
  })),
}));

// Helper to create a mock session
function createSession(id: string, customShortcut?: CustomShortcut): WorktreeSession {
  return {
    id,
    label: `Session ${id}`,
    path: `/test/path/${id}`,
    branchName: `branch-${id}`,
    createdAt: new Date().toISOString(),
    isExternal: false,
    customShortcut,
  };
}

describe('AssignShortcutDialog', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    const session = createSession('test-1');
    render(<AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />);

    expect(screen.getByText('Assign Keyboard Shortcut')).toBeInTheDocument();
    // Check for specific text in the description
    expect(screen.getByText(/Press a key combination to assign as a shortcut/)).toBeInTheDocument();
  });

  it('captures Ctrl+Shift+K shortcut', async () => {
    const session = createSession('test-1');
    const { container } = render(
      <AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />
    );

    // Simulate pressing Ctrl+Shift+K
    await act(async () => {
      fireEvent.keyDown(window, {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });
    });

    await waitFor(
      () => {
        expect(screen.getByText('Ctrl+Shift+K')).toBeInTheDocument();
      },
      { container }
    );
  });

  it('shows error for blocked shortcuts (Ctrl+C)', async () => {
    const session = createSession('test-1');
    const { container } = render(
      <AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />
    );

    // Simulate pressing Ctrl+C
    await act(async () => {
      fireEvent.keyDown(window, {
        key: 'c',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      });
    });

    await waitFor(
      () => {
        expect(screen.getByText(/reserved for system use/)).toBeInTheDocument();
      },
      { container }
    );
  });

  it('allows shortcuts without modifier keys', async () => {
    const session = createSession('test-1');
    const { container } = render(
      <AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />
    );

    // Simulate pressing just 'k'
    await act(async () => {
      fireEvent.keyDown(window, {
        key: 'k',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      });
    });

    await waitFor(
      () => {
        // Should display the shortcut and enable save button
        expect(screen.getByText('K')).toBeInTheDocument();
        const saveButton = screen.getByRole('button', { name: 'Save' });
        expect(saveButton).not.toBeDisabled();
      },
      { container }
    );
  });

  it('disables save button when shortcut is blocked', async () => {
    const session = createSession('test-1');
    const { container } = render(
      <AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />
    );

    // Simulate pressing Ctrl+C (blocked)
    await act(async () => {
      fireEvent.keyDown(window, {
        key: 'c',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      });
    });

    await waitFor(
      () => {
        const saveButton = screen.getByRole('button', { name: 'Save' });
        expect(saveButton).toBeDisabled();
      },
      { container }
    );
  });

  it('enables save button for valid shortcuts', async () => {
    const session = createSession('test-1');
    const { container } = render(
      <AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />
    );

    // Simulate pressing Ctrl+Shift+K (valid)
    await act(async () => {
      fireEvent.keyDown(window, {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });
    });

    await waitFor(
      () => {
        const saveButton = screen.getByRole('button', { name: 'Save' });
        expect(saveButton).not.toBeDisabled();
      },
      { container }
    );
  });

  it('calls updateSessionShortcut when saving', async () => {
    const session = createSession('test-1');
    const { container } = render(
      <AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />
    );

    // Simulate pressing Ctrl+Shift+K
    await act(async () => {
      fireEvent.keyDown(window, {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });
    });

    await waitFor(
      () => {
        expect(screen.getByText('Ctrl+Shift+K')).toBeInTheDocument();
      },
      { container }
    );

    // Click Save
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(mockUpdateWorktreeSessionShortcut).toHaveBeenCalledWith('test-1', {
      key: 'k',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    });
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows Clear Shortcut button when session has existing shortcut', () => {
    const shortcut: CustomShortcut = {
      key: '1',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    };
    const session = createSession('test-1', shortcut);
    render(<AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />);

    expect(screen.getByRole('button', { name: 'Clear Shortcut' })).toBeInTheDocument();
  });

  it('clears shortcut when Clear Shortcut is clicked', () => {
    const shortcut: CustomShortcut = {
      key: '1',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    };
    const session = createSession('test-1', shortcut);
    render(<AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Shortcut' }));

    expect(mockUpdateWorktreeSessionShortcut).toHaveBeenCalledWith('test-1', undefined);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not show Clear Shortcut button when session has no shortcut', () => {
    const session = createSession('test-1');
    render(<AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />);

    expect(screen.queryByRole('button', { name: 'Clear Shortcut' })).not.toBeInTheDocument();
  });

  it('ignores modifier-only key presses', async () => {
    const session = createSession('test-1');
    render(<AssignShortcutDialog open={true} onOpenChange={mockOnOpenChange} session={session} />);

    // Simulate pressing just Control
    fireEvent.keyDown(window, {
      key: 'Control',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });

    // Should still show the placeholder text
    expect(screen.getByText(/Press a key combination to capture/)).toBeInTheDocument();
  });
});
