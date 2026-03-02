import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddRepositoryScreen } from './AddRepositoryScreen';
import { useAppStore } from '../stores/appStore';
import { resetAllStores } from '../../../tests/utils';

// Mock the worktree discovery service
vi.mock('../services/worktreeDiscovery', () => ({
  discoverWorktreesForRepository: vi.fn().mockResolvedValue(undefined),
}));

// Mock the AlertDialog components to avoid Radix UI portal issues
vi.mock('./ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-header">{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="alert-dialog-description">{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-footer">{children}</div>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button data-testid="alert-dialog-action" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button data-testid="alert-dialog-cancel" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock the Checkbox component to avoid Radix UI issues
vi.mock('./ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      id={id}
      role="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

describe('AddRepositoryScreen', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    vi.mocked(window.terminal.selectFolder).mockResolvedValue(null);
    vi.mocked(window.terminal.isGitRepo).mockResolvedValue(false);
    vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
      branch: 'main',
      isDirty: false,
      additions: 0,
      deletions: 0,
    });
    vi.mocked(window.terminal.getBasename).mockImplementation(
      (path: string) => path.split('/').pop() || ''
    );
    vi.mocked(window.terminal.detectWorktree).mockResolvedValue({
      isWorktree: false,
      mainRepoPath: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic rendering', () => {
    it('renders the add repository screen', () => {
      render(<AddRepositoryScreen onBack={mockOnBack} />);
      expect(screen.getByRole('heading', { name: 'Add Repository' })).toBeInTheDocument();
      expect(screen.getByTestId('add-repository-screen')).toBeInTheDocument();
    });

    it('shows Local Folder tab by default', () => {
      render(<AddRepositoryScreen onBack={mockOnBack} />);
      expect(screen.getByText('Select Folder')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
    });

    it('switches to Clone tab when clicked', async () => {
      const user = userEvent.setup();
      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await user.click(screen.getByRole('button', { name: /clone repository/i }));

      expect(screen.getByText('Repository URL')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/github\.com/i)).toBeInTheDocument();
    });

    it('calls onBack when back button is clicked', async () => {
      const user = userEvent.setup();
      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await user.click(screen.getByRole('button', { name: /back/i }));

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it('renders Browse... button initially', () => {
      render(<AddRepositoryScreen onBack={mockOnBack} />);
      expect(screen.getByText('Browse...')).toBeInTheDocument();
    });

    it('renders Back button', () => {
      render(<AddRepositoryScreen onBack={mockOnBack} />);
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<AddRepositoryScreen onBack={mockOnBack} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders Local Folder tab', () => {
      render(<AddRepositoryScreen onBack={mockOnBack} />);
      expect(screen.getByText('Local Folder')).toBeInTheDocument();
    });

    it('renders Clone Repository tab', () => {
      render(<AddRepositoryScreen onBack={mockOnBack} />);
      expect(screen.getByText('Clone Repository')).toBeInTheDocument();
    });
  });

  describe('WSL Tip - Windows platform', () => {
    let originalPlatform: string | undefined;

    beforeEach(() => {
      // Save original platform
      originalPlatform = window.electronAPI?.platform;
      // Mock Windows platform by modifying the object property
      Object.defineProperty(window.electronAPI, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      // Restore original platform
      if (originalPlatform !== undefined) {
        Object.defineProperty(window.electronAPI, 'platform', {
          value: originalPlatform,
          writable: true,
          configurable: true,
        });
      }
    });

    it('shows WSL tip when default shell is wsl-ubuntu', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'wsl-ubuntu',
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.getByText('WSL Tip')).toBeInTheDocument();
      expect(screen.getByText(/\\\\wsl\$\\ubuntu\\home/)).toBeInTheDocument();
    });

    it('shows WSL tip when default shell is wsl-archlinux', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'wsl-archlinux',
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.getByText('WSL Tip')).toBeInTheDocument();
      expect(screen.getByText(/\\\\wsl\$\\archlinux\\home/)).toBeInTheDocument();
    });

    it('shows WSL tip when default shell is wsl-debian', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'wsl-debian',
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.getByText('WSL Tip')).toBeInTheDocument();
      expect(screen.getByText(/\\\\wsl\$\\debian\\home/)).toBeInTheDocument();
    });

    it('shows WSL tip for custom shell with -d argument', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'custom-wsl-shell',
          customShells: [
            {
              id: 'custom-wsl-shell',
              name: 'My WSL Shell',
              path: 'C:\\Windows\\System32\\wsl.exe',
              args: ['-d', 'Ubuntu-22.04'],
              icon: 'generic',
              isCustom: true,
            },
          ],
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.getByText('WSL Tip')).toBeInTheDocument();
      expect(screen.getByText(/\\\\wsl\$\\Ubuntu-22\.04\\home/)).toBeInTheDocument();
    });

    it('shows WSL tip for custom shell with --distribution argument', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'custom-wsl-shell',
          customShells: [
            {
              id: 'custom-wsl-shell',
              name: 'My WSL Shell',
              path: 'C:\\Windows\\System32\\wsl.exe',
              args: ['--distribution', 'openSUSE'],
              icon: 'generic',
              isCustom: true,
            },
          ],
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.getByText('WSL Tip')).toBeInTheDocument();
      expect(screen.getByText(/\\\\wsl\$\\openSUSE\\home/)).toBeInTheDocument();
    });

    it('shows generic WSL tip for custom shell without -d argument', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'custom-wsl-shell',
          customShells: [
            {
              id: 'custom-wsl-shell',
              name: 'Default WSL',
              path: 'C:\\Windows\\System32\\wsl.exe',
              icon: 'generic',
              isCustom: true,
            },
          ],
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.getByText('WSL Tip')).toBeInTheDocument();
      // Falls back to shell name
      expect(screen.getByText(/\\\\wsl\$\\Default WSL\\home/)).toBeInTheDocument();
    });

    it('shows generic WSL tip for custom shell without name', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'custom-wsl-shell',
          customShells: [
            {
              id: 'custom-wsl-shell',
              name: '',
              path: 'C:\\Windows\\System32\\wsl.exe',
              icon: 'generic',
              isCustom: true,
            },
          ],
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.getByText('WSL Tip')).toBeInTheDocument();
      // Falls back to generic 'WSL'
      expect(screen.getByText(/\\\\wsl\$\\WSL\\home/)).toBeInTheDocument();
    });

    it('does not show WSL tip when default shell is powershell', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'powershell',
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.queryByText('WSL Tip')).not.toBeInTheDocument();
    });

    it('does not show WSL tip when default shell is cmd', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'cmd',
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.queryByText('WSL Tip')).not.toBeInTheDocument();
    });

    it('does not show WSL tip when default shell is git-bash', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'git-bash',
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.queryByText('WSL Tip')).not.toBeInTheDocument();
    });

    it('does not show WSL tip when no default shell is set', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: null,
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.queryByText('WSL Tip')).not.toBeInTheDocument();
    });

    it('does not show WSL tip for custom non-WSL shell', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'custom-shell',
          customShells: [
            {
              id: 'custom-shell',
              name: 'My Shell',
              path: 'C:\\Program Files\\Git\\bin\\bash.exe',
              icon: 'generic',
              isCustom: true,
            },
          ],
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.queryByText('WSL Tip')).not.toBeInTheDocument();
    });

    it('shows WSL tip in Clone tab as well', async () => {
      const user = userEvent.setup();
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'wsl-ubuntu',
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      // Switch to Clone tab
      await user.click(screen.getByRole('button', { name: /clone repository/i }));

      expect(screen.getByText('WSL Tip')).toBeInTheDocument();
      expect(
        screen.getByText(/For better performance, clone directly into WSL/)
      ).toBeInTheDocument();
    });

    it('shows correct message in Local Folder tab', () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'wsl-ubuntu',
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.getByText(/To access repositories inside WSL/)).toBeInTheDocument();
    });

    it('shows correct message in Clone tab', async () => {
      const user = userEvent.setup();
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'wsl-ubuntu',
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);
      await user.click(screen.getByRole('button', { name: /clone repository/i }));

      expect(
        screen.getByText(/For better performance, clone directly into WSL/)
      ).toBeInTheDocument();
    });
  });

  describe('WSL Tip - non-Windows platforms', () => {
    let originalPlatform: string | undefined;

    beforeEach(() => {
      originalPlatform = window.electronAPI?.platform;
    });

    afterEach(() => {
      if (originalPlatform !== undefined) {
        Object.defineProperty(window.electronAPI, 'platform', {
          value: originalPlatform,
          writable: true,
          configurable: true,
        });
      }
    });

    it('does not show WSL tip on Linux', () => {
      Object.defineProperty(window.electronAPI, 'platform', {
        value: 'linux',
        writable: true,
        configurable: true,
      });

      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'wsl-ubuntu', // Even if somehow set
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.queryByText('WSL Tip')).not.toBeInTheDocument();
    });

    it('does not show WSL tip on macOS', () => {
      Object.defineProperty(window.electronAPI, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true,
      });

      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          defaultShell: 'wsl-ubuntu', // Even if somehow set
        },
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      expect(screen.queryByText('WSL Tip')).not.toBeInTheDocument();
    });
  });

  describe('folder selection', () => {
    it('calls selectFolder when browse button is clicked', async () => {
      const user = userEvent.setup();
      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await user.click(screen.getByRole('button', { name: /browse/i }));

      expect(window.terminal.selectFolder).toHaveBeenCalled();
    });

    it('shows selected folder after selection', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValueOnce('/home/user/my-project');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValueOnce(true);
      vi.mocked(window.terminal.detectWorktree).mockResolvedValueOnce({
        isWorktree: false,
        mainRepoPath: null,
      });
      vi.mocked(window.terminal.listWorktrees).mockResolvedValueOnce([]);

      const user = userEvent.setup();
      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await user.click(screen.getByRole('button', { name: /browse/i }));

      expect(await screen.findByText('my-project')).toBeInTheDocument();
      expect(screen.getByText('/home/user/my-project')).toBeInTheDocument();
      expect(screen.getByText('Git repository detected')).toBeInTheDocument();
    });

    it('calls getBasename when folder is selected', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/my-project');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(false);
      vi.mocked(window.terminal.getBasename).mockReturnValue('my-project');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(window.terminal.getBasename).toHaveBeenCalledWith('/test/my-project');
    });

    it('calls isGitRepo to detect git repositories', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/my-repo');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(true);
      vi.mocked(window.terminal.getBasename).mockReturnValue('my-repo');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(window.terminal.isGitRepo).toHaveBeenCalledWith('/test/my-repo');
    });
  });

  describe('cancel and back behavior', () => {
    it('calls onBack when Cancel is clicked', async () => {
      render(<AddRepositoryScreen onBack={mockOnBack} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnBack).toHaveBeenCalled();
    });

    it('calls onBack when Back is clicked', async () => {
      render(<AddRepositoryScreen onBack={mockOnBack} />);

      fireEvent.click(screen.getByText('Back'));

      expect(mockOnBack).toHaveBeenCalled();
    });
  });

  describe('non-git folder handling', () => {
    it('shows error state for non-git folders', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/plain-folder');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(false);
      vi.mocked(window.terminal.getBasename).mockReturnValue('plain-folder');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.getByText('This folder is not a Git repository')).toBeInTheDocument();
      expect(screen.getByText(/Run/)).toBeInTheDocument();
      expect(screen.getByText('Initialize Git repository for me')).toBeInTheDocument();
    });

    it('disables Add Repository button for non-git folders until checkbox is checked', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/plain-project');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(false);
      vi.mocked(window.terminal.getBasename).mockReturnValue('plain-project');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Button should be disabled
      const addButton = screen.getByRole('button', { name: 'Add Repository' });
      expect(addButton).toBeDisabled();

      // Check the "Initialize Git repository for me" checkbox
      const checkbox = screen.getByRole('checkbox');
      await act(async () => {
        fireEvent.click(checkbox);
      });

      // Button should now be enabled
      expect(addButton).not.toBeDisabled();
    });

    it('initializes git and adds repository when checkbox is checked', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/plain-project');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(false);
      vi.mocked(window.terminal.getBasename).mockReturnValue('plain-project');
      vi.mocked(window.terminal.initGitRepo).mockResolvedValue({ success: true });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      // Select folder
      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Check the checkbox
      const checkbox = screen.getByRole('checkbox');
      await act(async () => {
        fireEvent.click(checkbox);
      });

      // Confirm
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add Repository' }));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Check that initGitRepo was called
      expect(window.terminal.initGitRepo).toHaveBeenCalledWith('/test/plain-project');

      // Check store - should have been added since we initialized git
      const { repositories } = useAppStore.getState();
      expect(repositories).toHaveLength(1);
      expect(repositories[0].name).toBe('plain-project');
      expect(repositories[0].path).toBe('/test/plain-project');
    });

    it('shows error when git initialization fails', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/plain-project');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(false);
      vi.mocked(window.terminal.getBasename).mockReturnValue('plain-project');
      vi.mocked(window.terminal.initGitRepo).mockResolvedValue({
        success: false,
        error: 'Permission denied',
      });

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      // Select folder
      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Check the checkbox
      const checkbox = screen.getByRole('checkbox');
      await act(async () => {
        fireEvent.click(checkbox);
      });

      // Confirm
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add Repository' }));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should show error
      expect(screen.getByText('Permission denied')).toBeInTheDocument();

      // Repository should not be added
      const { repositories } = useAppStore.getState();
      expect(repositories).toHaveLength(0);
    });

    it('resets checkbox when folder changes', async () => {
      vi.mocked(window.terminal.selectFolder)
        .mockResolvedValueOnce('/test/first-folder')
        .mockResolvedValueOnce('/test/second-folder');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(false);
      vi.mocked(window.terminal.getBasename)
        .mockReturnValueOnce('first-folder')
        .mockReturnValueOnce('second-folder');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      // Select first folder
      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Check the checkbox
      const checkbox = screen.getByRole('checkbox');
      await act(async () => {
        fireEvent.click(checkbox);
      });

      expect(checkbox).toBeChecked();

      // Change folder
      await act(async () => {
        fireEvent.click(screen.getByText('Change folder'));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Checkbox should be unchecked
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });
  });

  describe('git repository selection', () => {
    it('shows git repository detected message for git repos', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/git-repo');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(true);
      vi.mocked(window.terminal.getBasename).mockReturnValue('git-repo');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.getByText('Git repository detected')).toBeInTheDocument();
    });

    it('enables Add Repository button for git repos', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/git-repo');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(true);
      vi.mocked(window.terminal.getBasename).mockReturnValue('git-repo');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const addButton = screen.getByRole('button', { name: 'Add Repository' });
      expect(addButton).not.toBeDisabled();
    });

    it('adds git repository to store on confirm', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/git-project');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(true);
      vi.mocked(window.terminal.getBasename).mockReturnValue('git-project');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      // Select folder
      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Confirm
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add Repository' }));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const { repositories } = useAppStore.getState();
      expect(repositories).toHaveLength(1);
      expect(repositories[0].name).toBe('git-project');
    });

    it('calls onBack after successful confirm', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue('/test/project');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(true);
      vi.mocked(window.terminal.getBasename).mockReturnValue('project');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      // Select folder
      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Confirm
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add Repository' }));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockOnBack).toHaveBeenCalled();
    });
  });

  describe('clone functionality', () => {
    it('disables Clone & Add button when URL is empty', async () => {
      const user = userEvent.setup();
      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await user.click(screen.getByRole('button', { name: /clone repository/i }));

      expect(screen.getByRole('button', { name: /clone & add/i })).toBeDisabled();
    });

    it('enables Clone & Add button when URL and destination are set', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValueOnce('/home/user/projects');

      const user = userEvent.setup();
      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await user.click(screen.getByRole('button', { name: /clone repository/i }));
      await user.type(
        screen.getByPlaceholderText(/github\.com/i),
        'https://github.com/user/repo.git'
      );
      await user.click(screen.getByRole('button', { name: /select destination/i }));

      expect(screen.getByRole('button', { name: /clone & add/i })).not.toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('handles null path from selectFolder (user cancelled)', async () => {
      vi.mocked(window.terminal.selectFolder).mockResolvedValue(null);

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should still show Browse... button (no path selected)
      expect(screen.getByText('Browse...')).toBeInTheDocument();
      expect(mockOnBack).not.toHaveBeenCalled();
    });

    it('displays error message when selectFolder fails', async () => {
      vi.mocked(window.terminal.selectFolder).mockRejectedValue(new Error('Network error'));

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.getByText(/Failed to select folder/)).toBeInTheDocument();
    });

    it('allows changing folder after selection', async () => {
      vi.mocked(window.terminal.selectFolder)
        .mockResolvedValueOnce('/test/first-project')
        .mockResolvedValueOnce('/test/second-project');
      vi.mocked(window.terminal.isGitRepo).mockResolvedValue(true);
      vi.mocked(window.terminal.getBasename)
        .mockReturnValueOnce('first-project')
        .mockReturnValueOnce('second-project');

      render(<AddRepositoryScreen onBack={mockOnBack} />);

      // Select first folder
      await act(async () => {
        fireEvent.click(screen.getByText('Browse...'));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(screen.getByText('first-project')).toBeInTheDocument();

      // Change folder
      await act(async () => {
        fireEvent.click(screen.getByText('Change folder'));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(screen.getByText('second-project')).toBeInTheDocument();
    });
  });
});
