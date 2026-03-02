import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeleteRepositoryDialog } from './DeleteRepositoryDialog';
import { useAppStore } from '../stores/appStore';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
} from '../../../tests/utils';

// Mock the Dialog components to avoid Radix UI portal issues
vi.mock('./ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="alert-dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  DialogDescription: ({
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
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-footer">{children}</div>
  ),
}));

// Mock the Button component
vi.mock('./ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button
      data-testid={variant === 'destructive' ? 'alert-dialog-action' : 'alert-dialog-cancel'}
      onClick={onClick}
      disabled={disabled}
    >
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

// Mock the Input component
vi.mock('./ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    autoFocus,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    autoFocus?: boolean;
  }) => (
    <input
      data-testid="confirm-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  ),
}));

// Helper to wait for a condition
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
  condition();
}

describe('DeleteRepositoryDialog', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    radioGroupOnValueChange = null;
    vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(false);
    vi.mocked(window.terminal.removeWorktree).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.forceRemoveWorktree).mockResolvedValue(undefined);
    vi.mocked(window.terminal.kill).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders nothing when repository is null', () => {
      render(
        <DeleteRepositoryDialog open={true} onOpenChange={mockOnOpenChange} repository={null} />
      );
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      render(
        <DeleteRepositoryDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          repository={repository}
        />
      );
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('renders dialog when open with repository', () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      render(
        <DeleteRepositoryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          repository={repository}
        />
      );
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
    });

    it('renders dialog title as Remove Repository', () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      render(
        <DeleteRepositoryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          repository={repository}
        />
      );
      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('Remove Repository');
    });

    it('renders repository name in description', () => {
      const repository = createMockRepository({ name: 'My Repository' });
      render(
        <DeleteRepositoryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          repository={repository}
        />
      );
      expect(screen.getByTestId('alert-dialog-description')).toHaveTextContent('My Repository');
    });

    it('renders Cancel button', () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      render(
        <DeleteRepositoryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          repository={repository}
        />
      );
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders Delete Repository button by default', () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      render(
        <DeleteRepositoryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          repository={repository}
        />
      );
      expect(screen.getByTestId('alert-dialog-action')).toHaveTextContent('Delete Repository');
    });

    it('renders radio options for delete mode', async () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      expect(screen.getByTestId('radio-delete-completely')).toBeInTheDocument();
      expect(screen.getByTestId('radio-remove-from-app')).toBeInTheDocument();
      expect(screen.getByText('Delete completely')).toBeInTheDocument();
      expect(screen.getByText('Remove from app')).toBeInTheDocument();
    });

    it('renders confirmation input for delete completely mode', async () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      expect(screen.getByTestId('confirm-input')).toBeInTheDocument();
    });

    it('shows repository name as placeholder for confirmation', async () => {
      const repository = createMockRepository({ name: 'My Repo' });
      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      expect(screen.getByTestId('confirm-input')).toHaveAttribute('placeholder', 'My Repo');
    });
  });

  describe('name confirmation', () => {
    it('disables delete button when confirmation text does not match', async () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Delete button should be disabled initially
      expect(screen.getByTestId('alert-dialog-action')).toBeDisabled();
    });

    it('enables delete button when confirmation text matches', async () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      fireEvent.change(screen.getByTestId('confirm-input'), {
        target: { value: 'Test Repository' },
      });

      expect(screen.getByTestId('alert-dialog-action')).not.toBeDisabled();
    });
  });

  describe('delete completely description', () => {
    it('shows description about deleting worktrees and branches', async () => {
      const repository = createMockRepository({
        name: 'Git Repository',
      });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      expect(
        screen.getByText(/includes deleting all worktrees and their local branches/i)
      ).toBeInTheDocument();
    });
  });

  describe('dirty worktree warning', () => {
    it('shows inline warning listing dirty worktrees', async () => {
      vi.mocked(window.terminal.isWorktreeDirty).mockImplementation(async (path) => {
        return path === '/test/worktree1';
      });

      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/main',
      });
      const dirtyWorktree = createMockWorktreeSession({
        id: 'wt-1',
        label: 'dirty-feature',
        branchName: 'dirty-feature',
        path: '/test/worktree1',
      });
      const cleanWorktree = createMockWorktreeSession({
        id: 'wt-2',
        label: 'clean-feature',
        branchName: 'clean-feature',
        path: '/test/worktree2',
      });
      const repository = createMockRepository({
        name: 'Git Repository',
        worktreeSessions: [mainSession, dirtyWorktree, cleanWorktree],
      });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should show warning about uncommitted changes
      expect(screen.getByText(/uncommitted changes will be lost/i)).toBeInTheDocument();
      // Should list the dirty worktree
      expect(screen.getByText('dirty-feature')).toBeInTheDocument();
    });
  });

  describe('untracked worktrees info', () => {
    it('shows info message when untracked worktrees exist', async () => {
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/repo',
        branchName: 'main',
      });
      const trackedSession = createMockWorktreeSession({
        id: 'wt-1',
        label: 'tracked-feature',
        path: '/test/worktree1',
        branchName: 'tracked-feature',
      });
      const repository = createMockRepository({
        name: 'Test Repository',
        path: '/test/repo',
        worktreeSessions: [mainSession, trackedSession],
      });

      // Mock listWorktrees to return more worktrees than tracked
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([
        {
          path: '/test/repo',
          branch: 'main',
          head: 'abc',
          isMain: true,
          isBare: false,
          isLocked: false,
          prunable: false,
        },
        {
          path: '/test/worktree1',
          branch: 'tracked-feature',
          head: 'def',
          isMain: false,
          isBare: false,
          isLocked: false,
          prunable: false,
        },
        {
          path: '/test/worktree2',
          branch: 'untracked-1',
          head: 'ghi',
          isMain: false,
          isBare: false,
          isLocked: false,
          prunable: false,
        },
        {
          path: '/test/worktree3',
          branch: 'untracked-2',
          head: 'jkl',
          isMain: false,
          isBare: false,
          isLocked: false,
          prunable: false,
        },
      ]);

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should show info about untracked worktrees
      expect(
        screen.getByText(/found 2 additional worktrees? not tracked by this app/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/all 4 worktrees will be deleted/i)).toBeInTheDocument();
    });

    it('does not show info message when no untracked worktrees exist', async () => {
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/repo',
      });
      const repository = createMockRepository({
        name: 'Test Repository',
        path: '/test/repo',
        worktreeSessions: [mainSession],
      });

      // Mock listWorktrees to return only tracked worktrees
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([
        {
          path: '/test/repo',
          branch: 'main',
          head: 'abc',
          isMain: true,
          isBare: false,
          isLocked: false,
          prunable: false,
        },
      ]);

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should NOT show info about untracked worktrees
      expect(screen.queryByText(/additional worktrees? not tracked/i)).not.toBeInTheDocument();
    });
  });

  describe('remove from app flow', () => {
    it('shows Remove from App button when that option is selected', async () => {
      const repository = createMockRepository({ name: 'Test Repository' });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
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

    it('hides confirmation input when Remove from app is selected', async () => {
      const repository = createMockRepository({ name: 'Test Repository' });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Initially confirmation input is visible
      expect(screen.getByTestId('confirm-input')).toBeInTheDocument();

      // Click the remove from app radio
      await act(async () => {
        fireEvent.click(screen.getByTestId('radio-remove-from-app'));
      });

      // Confirmation input should be hidden
      expect(screen.queryByTestId('confirm-input')).not.toBeInTheDocument();
    });

    it('removes repository from store without filesystem changes', async () => {
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/main',
      });
      const worktreeSession = createMockWorktreeSession({
        id: 'wt-1',
        label: 'feature',
        path: '/test/worktree',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        name: 'Test Repository',
        worktreeSessions: [mainSession, worktreeSession],
      });
      useAppStore.setState({ repositories: [repository] });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
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

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should remove from store
      const { repositories } = useAppStore.getState();
      expect(repositories).toHaveLength(0);

      // Should NOT call filesystem operations
      expect(window.terminal.removeWorktree).not.toHaveBeenCalled();
      expect(window.terminal.forceRemoveWorktree).not.toHaveBeenCalled();
    });

    it('enables Remove from App button without confirmation text', async () => {
      const repository = createMockRepository({ name: 'Test Repository' });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Select remove from app
      await act(async () => {
        fireEvent.click(screen.getByTestId('radio-remove-from-app'));
      });

      // Button should be enabled without confirmation text
      expect(screen.getByTestId('alert-dialog-action')).not.toBeDisabled();
    });
  });

  describe('cancel behavior', () => {
    it('calls onOpenChange(false) when Cancel is clicked', async () => {
      const repository = createMockRepository({ name: 'Test Repository' });
      const { unmount } = render(
        <DeleteRepositoryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          repository={repository}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);

      unmount();
    });
  });

  describe('delete flow', () => {
    it('shows delete button as disabled when name not confirmed', async () => {
      const repository = createMockRepository({
        id: 'proj-1',
        name: 'Test Repository',
        worktreeSessions: [],
      });
      useAppStore.setState({ repositories: [repository] });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Delete button should be disabled until name is confirmed
      expect(screen.getByTestId('alert-dialog-action')).toBeDisabled();
    });

    it('removes repository from store on successful deletion', async () => {
      const repository = createMockRepository({
        id: 'proj-1',
        name: 'Test Repository',
        worktreeSessions: [],
      });
      useAppStore.setState({ repositories: [repository] });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Type the repository name to enable the delete button
      fireEvent.change(screen.getByTestId('confirm-input'), {
        target: { value: 'Test Repository' },
      });

      // Click delete button
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // Wait for the store to be updated (includes 500ms delay for in-flight operations)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });

      const { repositories } = useAppStore.getState();
      expect(repositories).toHaveLength(0);
    });

    it('closes dialog after successful deletion', async () => {
      const repository = createMockRepository({
        id: 'proj-1',
        name: 'Test Repository',
        worktreeSessions: [],
      });
      useAppStore.setState({ repositories: [repository] });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Type the repository name to enable the delete button
      fireEvent.change(screen.getByTestId('confirm-input'), {
        target: { value: 'Test Repository' },
      });

      // Click delete button
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // Wait for the async operation to complete (includes 500ms delay for in-flight operations)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('deletes worktrees and branches when deleting completely', async () => {
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/main',
      });
      const worktreeSession = createMockWorktreeSession({
        id: 'wt-1',
        label: 'feature',
        branchName: 'feature-branch',
        path: '/test/worktree',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        name: 'Test Repository',
        path: '/test/project',
        worktreeSessions: [mainSession, worktreeSession],
      });
      useAppStore.setState({ repositories: [repository] });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Wait for dirty check
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Type the repository name
      fireEvent.change(screen.getByTestId('confirm-input'), {
        target: { value: 'Test Repository' },
      });

      // Click delete button
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        expect(window.terminal.removeWorktree).toHaveBeenCalledWith(
          '/test/worktree',
          true,
          'feature-branch'
        );
      });
    });
  });

  describe('cleanup script execution', () => {
    it('executes cleanup script for each deleted worktree', async () => {
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/main',
      });
      const worktreeSession = createMockWorktreeSession({
        id: 'wt-1',
        label: 'feature',
        branchName: 'feature-branch',
        path: '/test/worktree',
        portOffset: 3,
      });
      const repository = createMockRepository({
        id: 'proj-1',
        name: 'Test Repository',
        path: '/test/project',
        portRangeStart: 10000,
        worktreeSessions: [mainSession, worktreeSession],
        scriptsConfig: {
          setupScript: null,
          runScripts: [],
          cleanupScript: 'echo cleanup',
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });
      useAppStore.setState({ repositories: [repository] });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Wait for dirty check
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Type the repository name
      await act(async () => {
        fireEvent.change(screen.getByTestId('confirm-input'), {
          target: { value: 'Test Repository' },
        });
      });

      // Click delete button
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      // Wait for async operations
      await waitForCondition(() => {
        expect(window.terminal.runScript).toHaveBeenCalled();
      });

      // Verify cleanup script was run with correct env vars
      expect(window.terminal.runScript).toHaveBeenCalledWith(
        '/test/project',
        'echo cleanup',
        expect.objectContaining({
          TERMPAD_WORKSPACE_NAME: 'feature-branch',
          TERMPAD_WORKSPACE_PATH: '/test/worktree',
          TERMPAD_ROOT_PATH: '/test/project',
          TERMPAD_PORT: '10003',
        }),
        30000
      );
    });

    it('does not execute cleanup script when not configured', async () => {
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/main',
      });
      const worktreeSession = createMockWorktreeSession({
        id: 'wt-1',
        label: 'feature',
        branchName: 'feature-branch',
        path: '/test/worktree',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        name: 'Test Repository',
        path: '/test/project',
        worktreeSessions: [mainSession, worktreeSession],
        scriptsConfig: undefined,
      });
      useAppStore.setState({ repositories: [repository] });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Wait for dirty check
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Type the repository name
      fireEvent.change(screen.getByTestId('confirm-input'), {
        target: { value: 'Test Repository' },
      });

      // Click delete button
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        expect(window.terminal.removeWorktree).toHaveBeenCalled();
      });

      // runScript should not have been called for cleanup
      expect(window.terminal.runScript).not.toHaveBeenCalled();
    });

    it('runs cleanup script in background without creating terminal tab', async () => {
      const mainSession = createMockWorktreeSession({
        id: 'main-1',
        label: 'main',
        path: '/test/main',
      });
      const worktreeSession = createMockWorktreeSession({
        id: 'wt-1',
        label: 'feature',
        branchName: 'my-awesome-feature',
        path: '/test/worktree',
      });
      const repository = createMockRepository({
        id: 'proj-1',
        name: 'Test Repository',
        path: '/test/project',
        worktreeSessions: [mainSession, worktreeSession],
        scriptsConfig: {
          setupScript: null,
          runScripts: [],
          cleanupScript: 'npm run cleanup',
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });
      useAppStore.setState({ repositories: [repository] });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Wait for dirty check
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Type the repository name
      await act(async () => {
        fireEvent.change(screen.getByTestId('confirm-input'), {
          target: { value: 'Test Repository' },
        });
      });

      // Click delete button
      await act(async () => {
        fireEvent.click(screen.getByTestId('alert-dialog-action'));
      });

      await waitForCondition(() => {
        expect(window.terminal.runScript).toHaveBeenCalled();
      });

      // Verify runScript was called with correct args (runs in background, no terminal tab)
      expect(window.terminal.runScript).toHaveBeenCalledWith(
        '/test/project',
        'npm run cleanup',
        expect.objectContaining({
          TERMPAD_WORKSPACE_NAME: 'my-awesome-feature',
        }),
        30000
      );

      // Should NOT create user terminal tabs for cleanup
      const { userTerminalTabs } = useAppStore.getState();
      const mainSessionTabs = userTerminalTabs?.find((wt) => wt.worktreeSessionId === 'main-1');
      const cleanupTab = mainSessionTabs?.tabs.find((tab) =>
        tab.name.includes('Cleanup: my-awesome-feature')
      );
      expect(cleanupTab).toBeUndefined();
    });
  });

  describe('state reset', () => {
    it('resets state when repository changes', async () => {
      const repository1 = createMockRepository({ id: 'proj-1', name: 'Repository 1' });
      const repository2 = createMockRepository({ id: 'proj-2', name: 'Repository 2' });

      const { rerender, unmount } = render(
        <DeleteRepositoryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          repository={repository1}
        />
      );

      expect(screen.getByTestId('alert-dialog-description')).toHaveTextContent('Repository 1');

      rerender(
        <DeleteRepositoryDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          repository={repository2}
        />
      );

      expect(screen.getByTestId('alert-dialog-description')).toHaveTextContent('Repository 2');

      unmount();
    });

    it('shows empty confirmation input when dialog is opened', async () => {
      const repository = createMockRepository({ name: 'Test Repository' });

      await act(async () => {
        render(
          <DeleteRepositoryDialog
            open={true}
            onOpenChange={mockOnOpenChange}
            repository={repository}
          />
        );
      });

      // Confirmation input should start empty
      expect(screen.getByTestId('confirm-input')).toHaveValue('');
    });
  });
});
