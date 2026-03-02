import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AddWorktreeScreen } from './AddWorktreeScreen';
import { useAppStore } from '../stores/appStore';
import { resetAllStores, createMockRepository, createMockSettings } from '../../../tests/utils';

// Mock UI components to simplify testing
vi.mock('./ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('./ui/input', () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    ...props
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
  }) => <input id={id} value={value} onChange={onChange} placeholder={placeholder} {...props} />,
}));

vi.mock('./ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock('./ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: () => <input data-testid="command-input" />,
  CommandItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <div onClick={onSelect}>{children}</div>
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('./WorktreePicker', () => ({
  WorktreePicker: () => <div data-testid="worktree-picker" />,
}));

describe('AddWorktreeScreen', () => {
  const mockOnBack = vi.fn();
  const mockRepository = createMockRepository({
    id: 'repo-1',
    name: 'Test Repo',
    path: '/test/repo',
  });

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Set up repository in store
    useAppStore.setState({
      repositories: [mockRepository],
      settings: createMockSettings({ worktreeBasePath: '/test/worktrees' }),
      isInitialized: true,
    });

    // Mock createWorktree to succeed
    vi.mocked(window.terminal.createWorktree).mockResolvedValue({
      success: true,
      path: '/test/worktrees/test-branch',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('worktree creation', () => {
    it('creates worktree when form is submitted', async () => {
      render(<AddWorktreeScreen onBack={mockOnBack} repositoryId={mockRepository.id} />);

      // Enter worktree name
      const input = screen.getByPlaceholderText('e.g., fix-authentication-bug');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test-branch' } });
      });

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Worktree/i });
      await act(async () => {
        fireEvent.click(createButton);
      });

      // Verify createWorktree was called (the selectedBranch might be 'main' from mock)
      await waitFor(() => {
        expect(window.terminal.createWorktree).toHaveBeenCalledWith(
          mockRepository.path,
          'test-branch',
          '/test/worktrees',
          expect.any(String) // Branch might be auto-selected from mock
        );
      });

      // Verify onBack was called (navigating away)
      expect(mockOnBack).toHaveBeenCalled();
    });

    it('adds worktree session to repository after creation', async () => {
      render(<AddWorktreeScreen onBack={mockOnBack} repositoryId={mockRepository.id} />);

      // Enter worktree name
      const input = screen.getByPlaceholderText('e.g., fix-authentication-bug');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test-branch' } });
      });

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Worktree/i });
      await act(async () => {
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        const state = useAppStore.getState();
        const repo = state.repositories.find((r) => r.id === mockRepository.id);
        expect(repo?.worktreeSessions.length).toBe(1);
        expect(repo?.worktreeSessions[0].label).toBe('test-branch');
      });
    });
  });

  describe('setup script execution', () => {
    it('executes setup script after worktree creation if configured', async () => {
      // Configure repository with setup script
      const repoWithSetupScript = createMockRepository({
        id: 'repo-1',
        name: 'Test Repo',
        path: '/test/repo',
        scriptsConfig: {
          setupScript: 'npm install',
          runScripts: [],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });

      useAppStore.setState({
        repositories: [repoWithSetupScript],
      });

      render(<AddWorktreeScreen onBack={mockOnBack} repositoryId={repoWithSetupScript.id} />);

      // Enter worktree name
      const input = screen.getByPlaceholderText('e.g., fix-authentication-bug');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test-branch' } });
      });

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Worktree/i });
      await act(async () => {
        fireEvent.click(createButton);
      });

      // Wait for worktree to be created and user terminal tab to be created
      await waitFor(() => {
        const state = useAppStore.getState();
        const repo = state.repositories.find((r) => r.id === repoWithSetupScript.id);
        const worktreeSession = repo?.worktreeSessions[0];
        expect(worktreeSession).toBeDefined();
        const userTabs = state.getUserTabsForWorktree(worktreeSession!.id);
        expect(userTabs.length).toBe(1);
        expect(userTabs[0].name).toBe('Setup');
      });

      // Wait for the setTimeout delay and script execution
      await waitFor(
        () => {
          expect(window.terminal.write).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Verify the setup script command was written to the terminal
      const state = useAppStore.getState();
      const repo = state.repositories.find((r) => r.id === repoWithSetupScript.id);
      const worktreeSession = repo?.worktreeSessions[0];
      const userTabs = state.getUserTabsForWorktree(worktreeSession!.id);
      const terminalId = state.getUserTerminalIdForTab(worktreeSession!.id, userTabs[0].id);
      expect(window.terminal.write).toHaveBeenCalledWith(terminalId, 'npm install\n');
    });

    it('does not execute setup script if not configured', async () => {
      // Repository without setup script
      const repoWithoutSetupScript = createMockRepository({
        id: 'repo-1',
        name: 'Test Repo',
        path: '/test/repo',
        scriptsConfig: {
          setupScript: null, // No setup script
          runScripts: [],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });

      useAppStore.setState({
        repositories: [repoWithoutSetupScript],
      });

      render(<AddWorktreeScreen onBack={mockOnBack} repositoryId={repoWithoutSetupScript.id} />);

      // Enter worktree name
      const input = screen.getByPlaceholderText('e.g., fix-authentication-bug');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test-branch' } });
      });

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Worktree/i });
      await act(async () => {
        fireEvent.click(createButton);
      });

      // Wait for worktree to be created
      await waitFor(() => {
        expect(window.terminal.createWorktree).toHaveBeenCalled();
      });

      // Wait a bit for any potential setup script execution
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Verify NO user terminal tab was created
      const state = useAppStore.getState();
      const repo = state.repositories.find((r) => r.id === repoWithoutSetupScript.id);
      const worktreeSession = repo?.worktreeSessions[0];
      expect(worktreeSession).toBeDefined();

      const userTabs = state.getUserTabsForWorktree(worktreeSession!.id);
      expect(userTabs.length).toBe(0);

      // Verify terminal.write was NOT called
      expect(window.terminal.write).not.toHaveBeenCalled();
    });

    it('does not execute setup script if scriptsConfig is undefined', async () => {
      // Repository without scriptsConfig at all
      const repoWithoutScriptsConfig = createMockRepository({
        id: 'repo-1',
        name: 'Test Repo',
        path: '/test/repo',
        // scriptsConfig is undefined
      });

      useAppStore.setState({
        repositories: [repoWithoutScriptsConfig],
      });

      render(<AddWorktreeScreen onBack={mockOnBack} repositoryId={repoWithoutScriptsConfig.id} />);

      // Enter worktree name
      const input = screen.getByPlaceholderText('e.g., fix-authentication-bug');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test-branch' } });
      });

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Worktree/i });
      await act(async () => {
        fireEvent.click(createButton);
      });

      // Wait for worktree to be created
      await waitFor(() => {
        expect(window.terminal.createWorktree).toHaveBeenCalled();
      });

      // Wait a bit for any potential setup script execution
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Verify NO user terminal tab was created
      const state = useAppStore.getState();
      const repo = state.repositories.find((r) => r.id === repoWithoutScriptsConfig.id);
      const worktreeSession = repo?.worktreeSessions[0];
      expect(worktreeSession).toBeDefined();

      const userTabs = state.getUserTabsForWorktree(worktreeSession!.id);
      expect(userTabs.length).toBe(0);

      // Verify terminal.write was NOT called
      expect(window.terminal.write).not.toHaveBeenCalled();
    });

    it('executes multi-line setup script correctly', async () => {
      // Configure repository with multi-line setup script
      const multiLineSetupScript = 'npm install\nnpm run build\necho "Setup complete"';
      const repoWithMultiLineScript = createMockRepository({
        id: 'repo-1',
        name: 'Test Repo',
        path: '/test/repo',
        scriptsConfig: {
          setupScript: multiLineSetupScript,
          runScripts: [],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });

      useAppStore.setState({
        repositories: [repoWithMultiLineScript],
      });

      render(<AddWorktreeScreen onBack={mockOnBack} repositoryId={repoWithMultiLineScript.id} />);

      // Enter worktree name
      const input = screen.getByPlaceholderText('e.g., fix-authentication-bug');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test-branch' } });
      });

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Worktree/i });
      await act(async () => {
        fireEvent.click(createButton);
      });

      // Wait for worktree to be created and terminal write
      await waitFor(
        () => {
          expect(window.terminal.write).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Verify the full multi-line script was written
      const state = useAppStore.getState();
      const repo = state.repositories.find((r) => r.id === repoWithMultiLineScript.id);
      const worktreeSession = repo?.worktreeSessions[0];
      const userTabs = state.getUserTabsForWorktree(worktreeSession!.id);
      const terminalId = state.getUserTerminalIdForTab(worktreeSession!.id, userTabs[0].id);

      expect(window.terminal.write).toHaveBeenCalledWith(terminalId, multiLineSetupScript + '\n');
    });
  });

  describe('error handling', () => {
    it('shows error when worktree creation fails', async () => {
      // Mock createWorktree to fail
      vi.mocked(window.terminal.createWorktree).mockResolvedValue({
        success: false,
        error: 'Branch already exists',
      });

      render(<AddWorktreeScreen onBack={mockOnBack} repositoryId={mockRepository.id} />);

      // Enter worktree name
      const input = screen.getByPlaceholderText('e.g., fix-authentication-bug');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test-branch' } });
      });

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Worktree/i });
      await act(async () => {
        fireEvent.click(createButton);
      });

      // Wait for error to show
      await waitFor(() => {
        expect(screen.getByText('Branch already exists')).toBeInTheDocument();
      });

      // Verify onBack was NOT called (stayed on screen)
      expect(mockOnBack).not.toHaveBeenCalled();
    });

    it('does not execute setup script when worktree creation fails', async () => {
      // Mock createWorktree to fail
      vi.mocked(window.terminal.createWorktree).mockResolvedValue({
        success: false,
        error: 'Branch already exists',
      });

      // Configure repository with setup script
      const repoWithSetupScript = createMockRepository({
        id: 'repo-1',
        name: 'Test Repo',
        path: '/test/repo',
        scriptsConfig: {
          setupScript: 'npm install',
          runScripts: [],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });

      useAppStore.setState({
        repositories: [repoWithSetupScript],
      });

      render(<AddWorktreeScreen onBack={mockOnBack} repositoryId={repoWithSetupScript.id} />);

      // Enter worktree name
      const input = screen.getByPlaceholderText('e.g., fix-authentication-bug');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'test-branch' } });
      });

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Worktree/i });
      await act(async () => {
        fireEvent.click(createButton);
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Verify no user terminal was created and no script was executed
      expect(window.terminal.write).not.toHaveBeenCalled();
    });
  });
});
