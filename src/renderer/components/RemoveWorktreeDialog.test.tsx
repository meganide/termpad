import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoveWorktreeDialog } from './RemoveWorktreeDialog';
import { useAppStore } from '../stores/appStore';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
} from '../../../tests/utils';

// Helper to wait for a condition without requiring DOM container
async function waitForCondition(condition: () => boolean | void, timeout = 1000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const result = condition();
      if (result !== false) return;
    } catch {
      // Continue polling
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  condition(); // Final call to throw if still failing
}

// Mock the AlertDialog components to avoid Radix UI portal issues
vi.mock('./ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="alert-dialog-content" className={className}>
      {children}
    </div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-header">{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <p data-testid="alert-dialog-description" className={className}>
      {children}
    </p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-footer">{children}</div>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      data-testid="alert-dialog-action"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button data-testid="alert-dialog-cancel" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

// Store the onValueChange callback so we can trigger it from RadioGroupItem
let radioGroupOnValueChange: ((value: string) => void) | null = null;

// Mock the RadioGroup components
vi.mock('./ui/radio-group', () => ({
  RadioGroup: ({
    children,
    value,
    onValueChange,
    className,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
  }) => {
    // Store the callback for RadioGroupItem to use
    radioGroupOnValueChange = onValueChange;
    return (
      <div data-testid="radio-group" data-value={value} className={className}>
        {children}
      </div>
    );
  },
  RadioGroupItem: ({ value, id, className }: { value: string; id: string; className?: string }) => (
    <input
      type="radio"
      data-testid={`radio-${value}`}
      id={id}
      value={value}
      className={className}
      onClick={() => {
        // Trigger the stored callback
        if (radioGroupOnValueChange) {
          radioGroupOnValueChange(value);
        }
      }}
    />
  ),
}));

// Mock the Label component
vi.mock('./ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

describe('RemoveWorktreeDialog', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);
    vi.mocked(window.terminal.removeWorktree).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.forceRemoveWorktree).mockResolvedValue(undefined);
    vi.mocked(window.terminal.kill).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders nothing when session is null', () => {
      const repository = createMockRepository({ id: 'proj-1' });
      render(
        <RemoveWorktreeDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          session={null}
          repository={repository}
        />
      );
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('renders nothing when repository is null', () => {
      const session = createMockWorktreeSession({ label: 'feature' });
      render(
        <RemoveWorktreeDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          session={session}
          repository={null}
        />
      );
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
      const session = createMockWorktreeSession({ label: 'feature' });
      const repository = createMockRepository({ id: 'proj-1' });
      render(
        <RemoveWorktreeDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          session={session}
          repository={repository}
        />
      );
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('renders dialog when open with valid session and project', async () => {
      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
    });

    it('renders dialog title', async () => {
      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('Remove Worktree');
    });

    it('renders worktree name in description', async () => {
      const session = createMockWorktreeSession({
        label: 'my-feature-branch',
        path: '/test/wt',
      });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      expect(screen.getByTestId('alert-dialog-description')).toHaveTextContent('my-feature-branch');
    });

    it('renders Cancel button', async () => {
      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders Delete Worktree button by default', async () => {
      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      expect(screen.getByTestId('alert-dialog-action')).toBeInTheDocument();
      expect(screen.getByTestId('alert-dialog-action')).toHaveTextContent('Delete Worktree');
    });

    it('renders radio options for delete mode', async () => {
      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      expect(screen.getByTestId('radio-delete-completely')).toBeInTheDocument();
      expect(screen.getByTestId('radio-remove-from-app')).toBeInTheDocument();
      expect(screen.getByText('Delete completely')).toBeInTheDocument();
      expect(screen.getByText('Remove from app')).toBeInTheDocument();
    });
  });

  describe('dirty status check', () => {
    it('shows loading state while checking dirty status', async () => {
      let resolveCheck: ((value: boolean) => void) | undefined;
      vi.mocked(window.terminal.isWorktreeDirty).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCheck = resolve;
          })
      );

      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      render(
        <RemoveWorktreeDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          session={session}
          repository={repository}
        />
      );

      expect(screen.getByText('Checking worktree status...')).toBeInTheDocument();

      await act(async () => {
        resolveCheck?.(false);
      });
    });

    it('shows radio options for clean worktree', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      expect(screen.getByText('Delete completely')).toBeInTheDocument();
      expect(screen.getByText('Remove from app')).toBeInTheDocument();
    });

    it('shows warning for dirty worktree', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(true);

      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      expect(screen.getByText(/uncommitted changes/i)).toBeInTheDocument();
    });
  });

  describe('clean worktree deletion', () => {
    it('enables delete button for clean worktree without confirmation', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      expect(screen.getByTestId('alert-dialog-action')).not.toBeDisabled();
    });

    it('calls forceRemoveWorktree for clean worktree', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature-branch',
        path: '/test/worktree/feature',
      });
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/project',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        path: '/test/project',
        worktreeSessions: [mainSession, session],
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        expect(window.terminal.forceRemoveWorktree).toHaveBeenCalledWith(
          '/test/project',
          '/test/worktree/feature',
          'feature-branch'
        );
      });
    });
  });

  describe('dirty worktree deletion', () => {
    it('deletes dirty worktree directly without secondary confirmation', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(true);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature-branch',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/project',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        path: '/test/project',
        worktreeSessions: [mainSession, session],
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      // Single click should delete directly (warning is already shown in dialog)
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        expect(window.terminal.forceRemoveWorktree).toHaveBeenCalledWith(
          '/test/project',
          '/test/wt',
          'feature-branch'
        );
      });
    });
  });

  describe('remove from app flow', () => {
    it('shows Remove from App button when that option is selected', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      // Click the remove from app radio
      await act(async () => {
        fireEvent.click(screen.getByTestId('radio-remove-from-app'));
      });

      expect(screen.getByTestId('alert-dialog-action')).toHaveTextContent('Remove from App');
    });

    it('removes session from store without filesystem changes when Remove from app is selected', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({ id: 'main-1', label: 'main' });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      // Select remove from app
      await act(async () => {
        fireEvent.click(screen.getByTestId('radio-remove-from-app'));
      });

      // Click confirm
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // Should remove from store
      const { repositories } = useAppStore.getState();
      expect(repositories[0].worktreeSessions).toHaveLength(1);
      expect(repositories[0].worktreeSessions[0].id).toBe('main-1');

      // Should NOT call filesystem operations
      expect(window.terminal.removeWorktree).not.toHaveBeenCalled();
      expect(window.terminal.forceRemoveWorktree).not.toHaveBeenCalled();
      expect(window.terminal.kill).not.toHaveBeenCalled();
    });
  });

  describe('cancel behavior', () => {
    it('calls onOpenChange(false) when Cancel is clicked', async () => {
      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('delete flow', () => {
    it('removes session from project', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({ id: 'main-1', label: 'main' });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        const { repositories } = useAppStore.getState();
        expect(repositories[0].worktreeSessions).toHaveLength(1);
        expect(repositories[0].worktreeSessions[0].id).toBe('main-1');
      });
    });

    it('closes dialog after successful deletion', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({ id: 'main-1', label: 'main' });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('kills terminal before removing worktree', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({ id: 'main-1', label: 'main' });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        expect(window.terminal.killAllForWorktree).toHaveBeenCalledWith('sess-1');
      });
    });

    it('clears active terminal if deleted session was active', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({ id: 'main-1', label: 'main' });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository], activeTerminalId: 'sess-1' });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        const { activeTerminalId } = useAppStore.getState();
        expect(activeTerminalId).toBeNull();
      });
    });
  });

  describe('error handling', () => {
    it('displays generic error on exception', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);
      vi.mocked(window.terminal.forceRemoveWorktree).mockRejectedValue(new Error('Network error'));

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({ id: 'main-1', label: 'main' });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // Wait for the async operation to fail
      await waitForCondition(() => {
        expect(window.terminal.forceRemoveWorktree).toHaveBeenCalled();
      });

      // The dialog should stay open and show the error
      expect(mockOnOpenChange).not.toHaveBeenCalled();
      expect(screen.getByText('Failed to remove worktree')).toBeInTheDocument();
    });

    it('handles dirty check failure gracefully', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockRejectedValue(new Error('Check failed'));

      const session = createMockWorktreeSession({ label: 'feature', path: '/test/wt' });
      const repository = createMockRepository({ id: 'proj-1' });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      // Should show radio options (falls back to false on error)
      expect(screen.getByText('Delete completely')).toBeInTheDocument();
    });
  });

  describe('state reset', () => {
    it('resets state when session changes', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session1 = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature-1',
        path: '/test/wt1',
      });
      const session2 = createMockWorktreeSession({
        id: 'sess-2',
        label: 'feature-2',
        path: '/test/wt2',
      });
      const repository = createMockRepository({ id: 'proj-1' });

      let rerender: ReturnType<typeof render>['rerender'];

      await act(async () => {
        const result = render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session1}
            repository={repository}
          />
        );
        rerender = result.rerender;
      });

      expect(screen.getByText(/feature-1/)).toBeInTheDocument();

      await act(async () => {
        rerender(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session2}
            repository={repository}
          />
        );
      });

      expect(screen.getByText(/feature-2/)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles terminal kill failure gracefully', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);
      vi.mocked(window.terminal.kill).mockRejectedValue(new Error('Terminal not found'));

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({ id: 'main-1', label: 'main' });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // Should still complete successfully (kill failure is ignored)
      await waitForCondition(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('cleanup script execution', () => {
    it('executes cleanup script after deletion from repo root when configured', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
        portOffset: 5,
      });
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/project',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        path: '/test/project',
        portRangeStart: 10000,
        worktreeSessions: [mainSession, session],
        scriptsConfig: {
          setupScript: null,
          runScripts: [],
          cleanupScript: 'echo cleanup done',
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      // Click delete
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // First, worktree should be removed
      await waitForCondition(() => {
        expect(window.terminal.forceRemoveWorktree).toHaveBeenCalledWith(
          '/test/project',
          '/test/wt',
          'feature'
        );
      });

      // Cleanup script should be run in background with correct env vars
      await waitForCondition(() => {
        expect(window.terminal.runScript).toHaveBeenCalled();
      });

      expect(window.terminal.runScript).toHaveBeenCalledWith(
        '/test/project',
        'echo cleanup done',
        expect.objectContaining({
          TERMPAD_WORKSPACE_NAME: 'feature',
          TERMPAD_WORKSPACE_PATH: '/test/wt',
          TERMPAD_ROOT_PATH: '/test/project',
          TERMPAD_PORT: '10005',
        }),
        30000
      );
    });

    it('does not execute cleanup script when not configured', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/project',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
        scriptsConfig: undefined,
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // runScript should not have been called for cleanup
      await waitForCondition(() => {
        expect(window.terminal.forceRemoveWorktree).toHaveBeenCalled();
      });

      // Verify runScript was not called
      expect(window.terminal.runScript).not.toHaveBeenCalled();
    });

    it('does not execute cleanup script when cleanupScript is empty string', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/project',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
        scriptsConfig: {
          setupScript: 'npm install',
          runScripts: [],
          cleanupScript: '   ', // Whitespace only
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        expect(window.terminal.forceRemoveWorktree).toHaveBeenCalled();
      });

      // runScript should not have been called
      expect(window.terminal.runScript).not.toHaveBeenCalled();
    });

    it('runs cleanup script in background without creating terminal tab', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'my-feature-branch',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/project',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
        scriptsConfig: {
          setupScript: null,
          runScripts: [],
          cleanupScript: 'npm run cleanup',
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // Wait for runScript to be called
      await waitForCondition(() => {
        expect(window.terminal.runScript).toHaveBeenCalled();
      });

      // Verify runScript was called with correct params
      expect(window.terminal.runScript).toHaveBeenCalledWith(
        expect.any(String),
        'npm run cleanup',
        expect.objectContaining({
          TERMPAD_WORKSPACE_NAME: 'my-feature-branch',
        }),
        30000
      );

      // Should NOT create user terminal tabs for cleanup
      const { userTerminalTabs } = useAppStore.getState();
      const mainSessionTabs = userTerminalTabs?.find((wt) => wt.worktreeSessionId === 'main-1');
      const cleanupTab = mainSessionTabs?.tabs.find((tab) =>
        tab.name.includes('Cleanup: my-feature-branch')
      );
      expect(cleanupTab).toBeUndefined();
    });

    it('uses 30 second timeout for cleanup script', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);

      const session = createMockWorktreeSession({
        id: 'sess-1',
        label: 'feature',
        branchName: 'feature',
        path: '/test/wt',
      });
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/project',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        worktreeSessions: [mainSession, session],
        scriptsConfig: {
          setupScript: null,
          runScripts: [],
          cleanupScript: 'npm run cleanup',
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });

      await act(async () => {
        useAppStore.setState({ repositories: [repository] });
      });

      await act(async () => {
        render(
          <RemoveWorktreeDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            session={session}
            repository={repository}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // Wait for runScript to be called
      await waitForCondition(() => {
        expect(window.terminal.runScript).toHaveBeenCalled();
      });

      // Verify runScript was called with 30 second timeout
      expect(window.terminal.runScript).toHaveBeenCalledWith(
        expect.any(String),
        'npm run cleanup',
        expect.any(Object),
        30000
      );
    });
  });
});
